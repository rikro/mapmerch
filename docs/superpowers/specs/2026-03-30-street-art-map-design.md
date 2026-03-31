# Street Geometry Art Map — Design Spec

**Date:** 2026-03-30
**Status:** Approved

---

## Overview

A web application that lets users draw a boundary on a map, extract street geometry from OpenStreetMap within that boundary, and generate styled artwork that can be printed on physical products ordered via a print-on-demand service.

Primary audience: general consumers and gift buyers. Core emotional hook: turning a meaningful place (home neighborhood, a city block, a memorable area) into a personal keepsake or gift.

Monetization: markup on print-on-demand orders. No user accounts required for MVP.

---

## Architecture

Three-layer application:

1. **Frontend** (React + TypeScript) — Map interface, boundary drawing, artwork preview, style/product selection, checkout flow.
2. **Backend API** (Node.js / Express) — Geometry fetching from Overpass API, SVG art generation, order creation via Printful/Printify, webhook handling.
3. **Fulfillment** (Printful) — Print production and shipping. Backend acts as intermediary. Printify is a viable swap-in alternative with a near-identical API contract.

---

## Components

### Frontend

- **Map View** — Full-screen map with OpenStreetMap tiles. Freehand polygon draw tool (Leaflet Draw or Mapbox Draw). Undo/clear controls. Enforces max polygon area before submission.
- **Style Selector** — Thumbnail previews of available art styles. User picks a style; artwork preview updates. Initial styles: minimal line art, blueprint, watercolor-wash, bold graphic.
- **Product Selector** — Starts with prints, posters, and canvas. Displays a product mockup with the generated artwork applied.
- **Checkout Flow** — Collects shipping info, displays itemized price (including your markup), Stripe payment, triggers backend order on successful charge.

### Backend

- **Geometry Service** — Accepts a GeoJSON polygon, constructs and sends an Overpass API query, returns cleaned GeoJSON street data.
- **Art Engine** — Accepts GeoJSON + style parameters, outputs a styled resolution-independent SVG. Each style is a rendering preset (line weights, colors, padding, label visibility, etc.).
- **Order Service** — Accepts artwork + product + customer data, creates a Printful/Printify order via their API using idempotency keys, stores order record with status.
- **Webhook Handler** — Receives fulfillment status updates from Printful/Printify, updates stored order status.

---

## Data Flow

1. **Draw** — User draws polygon; coordinates held in frontend state.
2. **Generate** — `POST /api/artwork/generate` with polygon → backend returns SVG preview + `draft_id`.
3. **Customize** — Style/product changes re-call generate with updated params, reusing the same `draft_id`.
4. **Checkout** — `POST /api/orders` with `draft_id` + customer info. Backend locks artwork, charges via Stripe, creates Printful/Printify order on successful payment.
5. **Confirmation** — Order ID returned to user. Webhook updates order status asynchronously.

Session state: no user accounts. Draft state lives in the backend keyed by a session token. Draft expires after 24 hours.

---

## Error Handling

| Failure | Handling |
|---|---|
| Overpass API slow/unavailable | Retry with exponential backoff (3 attempts), then surface user-facing error: "Map data temporarily unavailable." |
| Polygon area too large | Frontend enforces max area limit before submission with a clear user message. |
| SVG generation failure | Generic user-facing error; full details logged server-side only. |
| Printful/Printify order failure | Queue for retry; notify user by email; do not charge until order confirmed. Use idempotency keys to prevent duplicate orders. |
| Payment failure | Surface Stripe error to user; do not create fulfillment order until payment succeeds. |

---

## Testing Strategy

**Unit tests:**
- Art engine: given GeoJSON + style preset, assert SVG output structure and key attributes.
- Geometry service: assert correct Overpass query construction from polygon input.
- Order service: mock Printful/Printify API responses, assert correct payload construction and idempotency key usage.

**Integration tests:**
- Full artwork generation pipeline against Overpass API (or recorded fixture).
- Printful/Printify sandbox for order creation end-to-end.

**Frontend tests (Playwright or Cypress):**
- Map draw interaction.
- Style/product selector state transitions.
- Checkout form validation.

**Manual QA:**
- Generate artwork, order a test print, verify output matches preview at full resolution before launch.

**MVP priority:** Art engine unit tests + one end-to-end test covering draw → generate → checkout.

---

## MVP Scope

**In scope:**
- Freehand polygon draw on OpenStreetMap
- Overpass API street geometry extraction
- SVG art generation with 4 initial styles
- Product catalog: prints, posters, canvas
- Printful or Printify integration
- Stripe checkout
- Order confirmation + status via webhooks
- No user accounts

**Out of scope for MVP (potential future):**
- Named neighborhood/zip code search
- Expanded product catalog (mugs, shirts, etc.)
- User accounts and order history
- Custom text/labels on artwork
- Sharing/social features
