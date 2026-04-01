# Map Interaction Improvements — Design Spec

**Date:** 2026-04-01  
**Status:** Approved

## Overview

Improve the map drawing step with location search, additional shape tools (rectangle and circle), removal of the non-functional edit button, and a functional delete button with confirmation.

---

## 1. Component Structure

### New: `LocationSearch.tsx`

A React component rendered as a CSS-positioned overlay on the map container (`absolute top-3 left-12 z-[1000]`, offset to clear Leaflet's zoom controls).

- Text input with search button — on Enter or click, fires `GET https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1` (includes `User-Agent` header per Nominatim usage policy). On result, calls `map.flyTo([lat, lon], 15)`.
- "Use My Location" button (lucide-react crosshair icon) — calls `navigator.geolocation.getCurrentPosition()`, on success calls `map.flyTo([lat, lng], 15)`.
- Error states (no result, geolocation denied, geolocation unavailable) shown as a small dismissible inline message below the input — not a modal.
- Debounced at 300ms to stay within Nominatim's ~1 req/sec rate limit.
- Receives a stable `mapRef: React.RefObject<L.Map | null>` prop from `MapView`.

### New: `DeleteConfirmModal.tsx`

A React modal overlay triggered by state in `MapView`.

- Renders as an absolutely-positioned overlay centered on the map container.
- Backdrop: `bg-black/40`. Card: white, Tailwind-styled, animated via `motion/react` to match app patterns.
- Content: "Are you sure you want to delete your selection?"
- Two buttons: **Cancel** (close modal, no action) and **Delete** (clear shape, fire reset callback, close modal).
- Only shown when a shape is actually drawn (guarded in `MapView`).

### Modified: `MapView.tsx`

Coordinates drawing logic, shape conversion, and both new components.

---

## 2. Draw Tool Configuration

Enable rectangle and circle in the leaflet-draw config:

```ts
draw: {
  polygon: { showArea: true },
  rectangle: { showArea: true },   // shift-to-square is built into leaflet-draw
  circle: { showRadius: true },
  polyline: false,
  circlemarker: false,
  marker: false,
},
edit: {
  featureGroup: drawnItems,
  edit: false,   // removes the pencil/edit button
},
```

- **Shift-to-square on rectangle**: leaflet-draw handles this natively — no custom code needed.
- **Circle**: no shift constraint (circle is always a circle — the shift redundancy is avoided).
- **Edit button**: suppressed by `edit: false`. The delete (trash) button remains in the toolbar.

---

## 3. Shape Handling & Data Flow

The existing `onPolygonComplete(PolygonCoords)` callback is reused for all shape types — no changes needed in parent components.

**Rectangle** — `L.Rectangle` extends `L.Polygon`; `layer.getLatLngs()[0]` gives corner points directly. Same code path as polygon.

**Circle** — `L.Circle` has no `getLatLngs()`. A helper converts it:

```ts
function circleToPolygon(
  center: L.LatLng,
  radiusMeters: number,
  numSides = 64
): [number, number][]
```

Uses trig to compute degree offsets from the center, accounting for latitude compression on the longitude axis. Returns a closed GeoJSON coordinate ring (`coords[0]` repeated at the end).

**`CREATED` event handler** gains a type switch:
- `polygon` | `rectangle` → existing path (shoelace area check + `onPolygonComplete`)
- `circle` → `circleToPolygon()` → same path

The `computeApproxAreaSqDeg` area check runs on the resulting polygon ring for all shapes.

A new optional prop `onShapeCleared?: () => void` is added to `MapView` so the parent can reset its polygon state when a shape is deleted.

---

## 4. Delete Interception & Confirmation Flow

After map initialization, a `click` listener is attached to the `.leaflet-draw-edit-remove` DOM element (leaflet-draw's trash button):

1. `e.stopPropagation()` — prevents leaflet-draw from entering its own multi-step delete mode.
2. Guard: only open modal if `drawnItems` has at least one layer.
3. Sets `showDeleteModal = true` in React state (via a ref-synced state or a direct setState call from within the Leaflet effect).

On **Confirm**:
- `drawnItems.clearLayers()`
- Call `onShapeCleared?.()` on the parent
- Close modal

On **Cancel**:
- Close modal, no action

---

## 5. Out of Scope

- Oval/ellipse tool (circle is used instead)
- Shift-to-circle constraint on the circle tool (redundant — it's already a circle)
- Geocoding provider other than Nominatim (deferred)
- Saving or persisting drawn shapes
- Multiple simultaneous shapes (existing behavior: one shape at a time, new shape replaces previous)
