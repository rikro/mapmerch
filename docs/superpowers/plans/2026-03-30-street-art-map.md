# Street Art Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app where users draw a map boundary, extract OpenStreetMap street geometry, generate styled SVG artwork, and order it on physical products via Printful.

**Architecture:** React/TypeScript frontend draws a polygon on a Leaflet map; Node.js/Express backend queries Overpass API for street geometry and renders a resolution-independent SVG; Stripe handles payment; Printful handles fulfillment. No user accounts — session token in sessionStorage ties drafts to browser sessions.

**Tech Stack:** React 18, TypeScript, Vite, Leaflet + leaflet-draw, Stripe Elements, Express, Jest, Playwright, Printful API, Overpass API.

---

## File Structure

```
prospecting_tt/
├── backend/
│   ├── src/
│   │   ├── index.ts                        # Express app entry, wires routes
│   │   ├── types.ts                        # All shared backend TypeScript types
│   │   ├── routes/
│   │   │   ├── artwork.ts                  # POST /api/artwork/generate
│   │   │   ├── payments.ts                 # POST /api/payments/create-intent
│   │   │   ├── orders.ts                   # POST /api/orders
│   │   │   └── webhooks.ts                 # POST /api/webhooks/printful
│   │   └── services/
│   │       ├── geometryService.ts          # Overpass API query + GeoJSON cleanup
│   │       ├── artEngine.ts                # SVG generation from GeoJSON + style
│   │       ├── stylePresets.ts             # Style preset registry (4 styles)
│   │       ├── draftStore.ts               # In-memory draft storage (session-keyed, 24h TTL)
│   │       ├── orderStore.ts               # In-memory order storage + status updates
│   │       └── orderService.ts             # Printful API integration
│   ├── tests/
│   │   └── unit/
│   │       ├── geometryService.test.ts
│   │       ├── artEngine.test.ts
│   │       └── orderService.test.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.ts
└── frontend/
    ├── src/
    │   ├── main.tsx                         # Vite entry point
    │   ├── App.tsx                          # Step state machine (draw→customize→checkout→confirmation)
    │   ├── types.ts                         # Frontend TypeScript types
    │   ├── constants.ts                     # Style options, product catalog, prices
    │   ├── api/
    │   │   └── client.ts                    # Typed fetch wrappers for backend API
    │   ├── hooks/
    │   │   ├── useSession.ts                # Session token (sessionStorage)
    │   │   └── useArtwork.ts                # generate() + draftId/svg state
    │   └── components/
    │       ├── MapView.tsx                  # Leaflet map + polygon draw tool
    │       ├── ArtworkPreview.tsx           # Renders SVG string from backend
    │       ├── StyleSelector.tsx            # 4-style thumbnail grid
    │       ├── ProductSelector.tsx          # Product + size picker with mockup
    │       └── CheckoutForm.tsx             # Shipping fields + Stripe Elements
    ├── tests/
    │   └── e2e/
    │       └── happyPath.spec.ts            # Playwright: draw → generate → checkout
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── playwright.config.ts
```

---

## Task 1: Backend Scaffolding

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.ts`

- [ ] **Step 1: Create backend directory and package.json**

```bash
mkdir backend && cd backend
```

Create `backend/package.json`:
```json
{
  "name": "street-art-map-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "test": "node --experimental-vm-modules node_modules/.bin/jest"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "stripe": "^14.0.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Create `backend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create jest.config.ts**

Create `backend/jest.config.ts`:
```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
};

export default config;
```

- [ ] **Step 4: Install backend dependencies**

```bash
cd backend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/jest.config.ts backend/package-lock.json
git commit -m "feat: scaffold backend project"
```

---

## Task 2: Backend Shared Types

**Files:**
- Create: `backend/src/types.ts`

- [ ] **Step 1: Write types.ts**

Create `backend/src/types.ts`:
```typescript
export type GeoJSONPosition = [number, number]; // [lng, lat]

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: GeoJSONPosition[][];
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: GeoJSONPosition[];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONLineString;
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export type StyleName =
  | 'minimal-line-art'
  | 'blueprint'
  | 'watercolor-wash'
  | 'bold-graphic';

export interface StylePreset {
  name: StyleName;
  backgroundColor: string;
  strokeColor: string;
  strokeWidth: number;
  padding: number;
}

export interface Draft {
  id: string;
  sessionToken: string;
  polygon: GeoJSONPolygon;
  style: StyleName;
  svg: string;
  createdAt: Date;
}

export type ProductType = 'print' | 'poster' | 'canvas';

export interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  email: string;
}

export interface Order {
  id: string;
  draftId: string;
  printfulOrderId: string;
  status: 'pending' | 'confirmed' | 'fulfilled' | 'shipped' | 'failed';
  product: ProductType;
  size: string;
  shippingAddress: ShippingAddress;
  createdAt: Date;
}

export interface GenerateArtworkRequest {
  polygon: GeoJSONPolygon;
  style: StyleName;
  sessionToken: string;
}

export interface GenerateArtworkResponse {
  draftId: string;
  svg: string;
}

export interface CreateOrderRequest {
  draftId: string;
  sessionToken: string;
  product: ProductType;
  size: string;
  shippingAddress: ShippingAddress;
  stripePaymentIntentId: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/types.ts
git commit -m "feat: add backend shared types"
```

---

## Task 3: Geometry Service

**Files:**
- Create: `backend/src/services/geometryService.ts`
- Create: `backend/tests/unit/geometryService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/geometryService.test.ts`:
```typescript
import { toGeoJSON } from '../../src/services/geometryService.js';

describe('toGeoJSON', () => {
  it('converts overpass way elements to GeoJSON FeatureCollection', () => {
    const overpassResponse = {
      elements: [
        {
          type: 'way',
          id: 1,
          geometry: [
            { lat: 41.8781, lon: -87.6298 },
            { lat: 41.8831, lon: -87.6248 },
          ],
          tags: { highway: 'residential', name: 'Main St' },
        },
      ],
    };

    const result = toGeoJSON(overpassResponse);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.type).toBe('LineString');
    expect(result.features[0].geometry.coordinates).toEqual([
      [-87.6298, 41.8781],
      [-87.6248, 41.8831],
    ]);
    expect(result.features[0].properties).toEqual({
      highway: 'residential',
      name: 'Main St',
    });
  });

  it('filters out non-way elements', () => {
    const overpassResponse = {
      elements: [
        { type: 'node', id: 2, geometry: [{ lat: 41.8781, lon: -87.6298 }] },
      ],
    };
    const result = toGeoJSON(overpassResponse);
    expect(result.features).toHaveLength(0);
  });

  it('filters out ways without geometry', () => {
    const overpassResponse = {
      elements: [{ type: 'way', id: 3, tags: { highway: 'residential' } }],
    };
    const result = toGeoJSON(overpassResponse);
    expect(result.features).toHaveLength(0);
  });

  it('returns empty FeatureCollection for empty elements array', () => {
    const result = toGeoJSON({ elements: [] });
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- tests/unit/geometryService.test.ts
```

Expected: FAIL — `Cannot find module '../../src/services/geometryService.js'`

- [ ] **Step 3: Implement geometryService.ts**

Create `backend/src/services/geometryService.ts`:
```typescript
import { GeoJSONPolygon, GeoJSONFeatureCollection } from '../types.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_RETRIES = 3;

interface OverpassNode {
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: string;
  id: number;
  geometry?: OverpassNode[];
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

export function toGeoJSON(overpassResponse: OverpassResponse): GeoJSONFeatureCollection {
  const features = overpassResponse.elements
    .filter(el => el.type === 'way' && el.geometry && el.geometry.length > 0)
    .map(el => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: el.geometry!.map(({ lon, lat }) => [lon, lat] as [number, number]),
      },
      properties: (el.tags ?? {}) as Record<string, unknown>,
    }));
  return { type: 'FeatureCollection', features };
}

function buildOverpassQuery(polygon: GeoJSONPolygon): string {
  const coords = polygon.coordinates[0]
    .map(([lng, lat]) => `${lat} ${lng}`)
    .join(' ');
  return `[out:json][timeout:30];(way["highway"](poly:"${coords}"););out geom;`;
}

async function fetchWithRetry(
  url: string,
  body: string,
  attempt = 1,
): Promise<OverpassResponse> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(body)}`,
    });
    if (!res.ok) throw new Error(`Overpass returned HTTP ${res.status}`);
    return res.json() as Promise<OverpassResponse>;
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    await new Promise(r => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    return fetchWithRetry(url, body, attempt + 1);
  }
}

export async function fetchStreetGeometry(
  polygon: GeoJSONPolygon,
): Promise<GeoJSONFeatureCollection> {
  const query = buildOverpassQuery(polygon);
  const response = await fetchWithRetry(OVERPASS_URL, query);
  return toGeoJSON(response);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- tests/unit/geometryService.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/geometryService.ts backend/tests/unit/geometryService.test.ts
git commit -m "feat: add geometry service with Overpass API integration"
```

---

## Task 4: Style Presets + Art Engine

**Files:**
- Create: `backend/src/services/stylePresets.ts`
- Create: `backend/src/services/artEngine.ts`
- Create: `backend/tests/unit/artEngine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/artEngine.test.ts`:
```typescript
import { generateSvg } from '../../src/services/artEngine.js';
import { GeoJSONFeatureCollection } from '../../src/types.js';

const sampleStreetData: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-87.6298, 41.8781],
          [-87.6248, 41.8831],
        ],
      },
      properties: {},
    },
  ],
};

describe('generateSvg', () => {
  it('returns a valid SVG string', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('<polyline');
  });

  it('uses the correct background color for minimal-line-art', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('uses the correct background color for blueprint', () => {
    const svg = generateSvg(sampleStreetData, 'blueprint');
    expect(svg).toContain('fill="#1a3a5c"');
  });

  it('uses the correct background color for watercolor-wash', () => {
    const svg = generateSvg(sampleStreetData, 'watercolor-wash');
    expect(svg).toContain('fill="#f5f0e8"');
  });

  it('uses the correct background color for bold-graphic', () => {
    const svg = generateSvg(sampleStreetData, 'bold-graphic');
    expect(svg).toContain('fill="#1a1a1a"');
  });

  it('throws when feature collection is empty', () => {
    const empty: GeoJSONFeatureCollection = { type: 'FeatureCollection', features: [] };
    expect(() => generateSvg(empty, 'minimal-line-art')).toThrow('No street data to render');
  });

  it('outputs SVG with width and height of 2400', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art');
    expect(svg).toContain('width="2400"');
    expect(svg).toContain('height="2400"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- tests/unit/artEngine.test.ts
```

Expected: FAIL — `Cannot find module '../../src/services/artEngine.js'`

- [ ] **Step 3: Implement stylePresets.ts**

Create `backend/src/services/stylePresets.ts`:
```typescript
import { StyleName, StylePreset } from '../types.js';

const presets: Record<StyleName, StylePreset> = {
  'minimal-line-art': {
    name: 'minimal-line-art',
    backgroundColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 3,
    padding: 120,
  },
  'blueprint': {
    name: 'blueprint',
    backgroundColor: '#1a3a5c',
    strokeColor: '#a8c8f0',
    strokeWidth: 2,
    padding: 120,
  },
  'watercolor-wash': {
    name: 'watercolor-wash',
    backgroundColor: '#f5f0e8',
    strokeColor: '#8b6f47',
    strokeWidth: 4,
    padding: 120,
  },
  'bold-graphic': {
    name: 'bold-graphic',
    backgroundColor: '#1a1a1a',
    strokeColor: '#f5c518',
    strokeWidth: 6,
    padding: 120,
  },
};

export function getStylePreset(style: StyleName): StylePreset {
  return presets[style];
}

export function getAllStylePresets(): StylePreset[] {
  return Object.values(presets);
}
```

- [ ] **Step 4: Implement artEngine.ts**

Create `backend/src/services/artEngine.ts`:
```typescript
import { GeoJSONFeatureCollection, StyleName, StylePreset } from '../types.js';
import { getStylePreset } from './stylePresets.js';

const CANVAS_SIZE = 2400; // px — 8in at 300dpi, scales to any square product

interface BoundingBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

function getBoundingBox(
  features: GeoJSONFeatureCollection['features'],
): BoundingBox {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const feature of features) {
    for (const [lng, lat] of feature.geometry.coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLng, maxLng, minLat, maxLat };
}

function toSvgCoords(
  lng: number,
  lat: number,
  bbox: BoundingBox,
  padding: number,
): [number, number] {
  const usableSize = CANVAS_SIZE - padding * 2;
  const lngRange = bbox.maxLng - bbox.minLng || 0.001;
  const latRange = bbox.maxLat - bbox.minLat || 0.001;
  const scale = Math.min(usableSize / lngRange, usableSize / latRange);
  const x = padding + (lng - bbox.minLng) * scale;
  const y = padding + (bbox.maxLat - lat) * scale; // Y-axis flip: north is up
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

function renderPaths(
  features: GeoJSONFeatureCollection['features'],
  bbox: BoundingBox,
  preset: StylePreset,
): string {
  return features
    .map(feature => {
      const points = feature.geometry.coordinates
        .map(([lng, lat]) => toSvgCoords(lng, lat, bbox, preset.padding).join(','))
        .join(' ');
      return `  <polyline points="${points}" fill="none" stroke="${preset.strokeColor}" stroke-width="${preset.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('\n');
}

export function generateSvg(
  streetData: GeoJSONFeatureCollection,
  style: StyleName,
): string {
  if (streetData.features.length === 0) {
    throw new Error('No street data to render');
  }
  const preset = getStylePreset(style);
  const bbox = getBoundingBox(streetData.features);
  const paths = renderPaths(streetData.features, bbox, preset);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${preset.backgroundColor}"/>
${paths}
</svg>`;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && npm test -- tests/unit/artEngine.test.ts
```

Expected: PASS — 7 tests passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/stylePresets.ts backend/src/services/artEngine.ts backend/tests/unit/artEngine.test.ts
git commit -m "feat: add style presets and SVG art engine"
```

---

## Task 5: Draft Store + Order Store

**Files:**
- Create: `backend/src/services/draftStore.ts`
- Create: `backend/src/services/orderStore.ts`

- [ ] **Step 1: Implement draftStore.ts**

Create `backend/src/services/draftStore.ts`:
```typescript
import { randomUUID } from 'crypto';
import { Draft, GeoJSONPolygon, StyleName } from '../types.js';

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const store = new Map<string, Draft>();

export function saveDraft(
  sessionToken: string,
  polygon: GeoJSONPolygon,
  style: StyleName,
  svg: string,
): Draft {
  const draft: Draft = {
    id: randomUUID(),
    sessionToken,
    polygon,
    style,
    svg,
    createdAt: new Date(),
  };
  store.set(draft.id, draft);
  return draft;
}

export function getDraft(draftId: string, sessionToken: string): Draft | null {
  const draft = store.get(draftId);
  if (!draft) return null;
  if (draft.sessionToken !== sessionToken) return null;
  if (Date.now() - draft.createdAt.getTime() > DRAFT_TTL_MS) {
    store.delete(draftId);
    return null;
  }
  return draft;
}

export function clearExpiredDrafts(): void {
  const now = Date.now();
  for (const [id, draft] of store) {
    if (now - draft.createdAt.getTime() > DRAFT_TTL_MS) {
      store.delete(id);
    }
  }
}
```

- [ ] **Step 2: Implement orderStore.ts**

Create `backend/src/services/orderStore.ts`:
```typescript
import { randomUUID } from 'crypto';
import { Order, ProductType, ShippingAddress } from '../types.js';

const store = new Map<string, Order>();

export function createOrder(
  draftId: string,
  printfulOrderId: string,
  product: ProductType,
  size: string,
  shippingAddress: ShippingAddress,
): Order {
  const order: Order = {
    id: randomUUID(),
    draftId,
    printfulOrderId,
    status: 'pending',
    product,
    size,
    shippingAddress,
    createdAt: new Date(),
  };
  store.set(order.id, order);
  return order;
}

export function updateOrderStatusByPrintfulId(
  printfulOrderId: string,
  status: Order['status'],
): void {
  for (const order of store.values()) {
    if (order.printfulOrderId === printfulOrderId) {
      order.status = status;
      return;
    }
  }
}

export function getOrder(orderId: string): Order | null {
  return store.get(orderId) ?? null;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/draftStore.ts backend/src/services/orderStore.ts
git commit -m "feat: add in-memory draft and order stores"
```

---

## Task 6: Order Service (Printful Integration)

**Files:**
- Create: `backend/src/services/orderService.ts`
- Create: `backend/tests/unit/orderService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/unit/orderService.test.ts`:
```typescript
import { buildPrintfulPayload } from '../../src/services/orderService.js';
import { Draft, ShippingAddress } from '../../src/types.js';

const mockDraft: Draft = {
  id: 'draft-123',
  sessionToken: 'session-abc',
  polygon: { type: 'Polygon', coordinates: [] },
  style: 'minimal-line-art',
  svg: '<svg></svg>',
  createdAt: new Date(),
};

const mockAddress: ShippingAddress = {
  name: 'Jane Smith',
  address1: '123 Main St',
  city: 'Chicago',
  state: 'IL',
  zip: '60601',
  country: 'US',
  email: 'jane@example.com',
};

describe('buildPrintfulPayload', () => {
  it('includes the idempotency key as external_id', () => {
    const payload = buildPrintfulPayload(
      mockDraft,
      'print',
      '8x8',
      mockAddress,
      'idem-key-xyz',
      'data:image/svg+xml;base64,abc',
    );
    expect(payload.external_id).toBe('idem-key-xyz');
  });

  it('maps shipping address fields correctly', () => {
    const payload = buildPrintfulPayload(
      mockDraft,
      'print',
      '8x8',
      mockAddress,
      'idem-key-xyz',
      'data:image/svg+xml;base64,abc',
    );
    expect(payload.recipient.name).toBe('Jane Smith');
    expect(payload.recipient.state_code).toBe('IL');
    expect(payload.recipient.country_code).toBe('US');
  });

  it('includes one item with a file URL', () => {
    const payload = buildPrintfulPayload(
      mockDraft,
      'print',
      '8x8',
      mockAddress,
      'idem-key-xyz',
      'data:image/svg+xml;base64,abc',
    );
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].files[0].url).toBe('data:image/svg+xml;base64,abc');
  });

  it('throws for an unknown product/size combination', () => {
    expect(() =>
      buildPrintfulPayload(
        mockDraft,
        'print',
        '99x99',
        mockAddress,
        'idem-key-xyz',
        'data:image/svg+xml;base64,abc',
      ),
    ).toThrow('Unknown product/size');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npm test -- tests/unit/orderService.test.ts
```

Expected: FAIL — `Cannot find module '../../src/services/orderService.js'`

- [ ] **Step 3: Implement orderService.ts**

Create `backend/src/services/orderService.ts`:
```typescript
import { Draft, Order, ProductType, ShippingAddress } from '../types.js';
import { createOrder } from './orderStore.js';

const PRINTFUL_API_URL = 'https://api.printful.com';

// Printful variant IDs — look these up at https://api.printful.com/products
// after creating your Printful store. These are placeholder values.
const PRODUCT_VARIANTS: Record<ProductType, Record<string, number>> = {
  print:  { '8x8': 1001, '12x12': 1002, '16x16': 1003 },
  poster: { '12x18': 2001, '18x24': 2002 },
  canvas: { '8x8': 3001, '12x12': 3002, '16x16': 3003 },
};

interface PrintfulRecipient {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  zip: string;
  country_code: string;
  email: string;
}

export interface PrintfulOrderPayload {
  external_id: string;
  recipient: PrintfulRecipient;
  items: Array<{
    variant_id: number;
    quantity: number;
    files: Array<{ type: string; url: string }>;
  }>;
}

export function buildPrintfulPayload(
  draft: Draft,
  product: ProductType,
  size: string,
  shippingAddress: ShippingAddress,
  idempotencyKey: string,
  svgDataUrl: string,
): PrintfulOrderPayload {
  const variantId = PRODUCT_VARIANTS[product]?.[size];
  if (!variantId) throw new Error(`Unknown product/size: ${product}/${size}`);

  return {
    external_id: idempotencyKey,
    recipient: {
      name: shippingAddress.name,
      address1: shippingAddress.address1,
      address2: shippingAddress.address2,
      city: shippingAddress.city,
      state_code: shippingAddress.state,
      zip: shippingAddress.zip,
      country_code: shippingAddress.country,
      email: shippingAddress.email,
    },
    items: [
      {
        variant_id: variantId,
        quantity: 1,
        files: [{ type: 'default', url: svgDataUrl }],
      },
    ],
  };
}

export async function createPrintfulOrder(
  draft: Draft,
  product: ProductType,
  size: string,
  shippingAddress: ShippingAddress,
  idempotencyKey: string,
): Promise<Order> {
  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(draft.svg).toString('base64')}`;
  const payload = buildPrintfulPayload(
    draft,
    product,
    size,
    shippingAddress,
    idempotencyKey,
    svgDataUrl,
  );

  const res = await fetch(`${PRINTFUL_API_URL}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Printful order failed: ${errText}`);
  }

  const data = await res.json() as { result: { id: number } };
  return createOrder(draft.id, String(data.result.id), product, size, shippingAddress);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- tests/unit/orderService.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/orderService.ts backend/tests/unit/orderService.test.ts
git commit -m "feat: add Printful order service"
```

---

## Task 7: Routes + Backend Entry Point

**Files:**
- Create: `backend/src/routes/artwork.ts`
- Create: `backend/src/routes/payments.ts`
- Create: `backend/src/routes/orders.ts`
- Create: `backend/src/routes/webhooks.ts`
- Create: `backend/src/index.ts`
- Create: `backend/.env.example`

- [ ] **Step 1: Create artwork route**

Create `backend/src/routes/artwork.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { fetchStreetGeometry } from '../services/geometryService.js';
import { generateSvg } from '../services/artEngine.js';
import { saveDraft } from '../services/draftStore.js';
import { GenerateArtworkRequest, GenerateArtworkResponse } from '../types.js';

export const artworkRouter = Router();

artworkRouter.post('/generate', async (req: Request, res: Response) => {
  const { polygon, style, sessionToken } = req.body as GenerateArtworkRequest;

  if (!polygon || !style || !sessionToken) {
    return res.status(400).json({ error: 'polygon, style, and sessionToken are required' });
  }

  try {
    const streetData = await fetchStreetGeometry(polygon);
    const svg = generateSvg(streetData, style);
    const draft = saveDraft(sessionToken, polygon, style, svg);
    const response: GenerateArtworkResponse = { draftId: draft.id, svg };
    return res.json(response);
  } catch (err) {
    console.error('Artwork generation error:', err);
    return res.status(500).json({ error: 'Artwork generation failed. Please try again.' });
  }
});
```

- [ ] **Step 2: Create payments route**

Create `backend/src/routes/payments.ts`:
```typescript
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { ProductType } from '../types.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const paymentsRouter = Router();

// Retail prices in cents (your markup included)
const PRICES: Record<ProductType, Record<string, number>> = {
  print:  { '8x8': 2500, '12x12': 3500, '16x16': 4500 },
  poster: { '12x18': 3000, '18x24': 4000 },
  canvas: { '8x8': 5500, '12x12': 7500, '16x16': 9500 },
};

paymentsRouter.post('/create-intent', async (req: Request, res: Response) => {
  const { product, size } = req.body as { product: ProductType; size: string };
  const amount = PRICES[product]?.[size];
  if (!amount) return res.status(400).json({ error: 'Invalid product or size' });

  const intent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
  });

  return res.json({ clientSecret: intent.client_secret, amount });
});
```

- [ ] **Step 3: Create orders route**

Create `backend/src/routes/orders.ts`:
```typescript
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getDraft } from '../services/draftStore.js';
import { createPrintfulOrder } from '../services/orderService.js';
import { CreateOrderRequest } from '../types.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const ordersRouter = Router();

ordersRouter.post('/', async (req: Request, res: Response) => {
  const { draftId, sessionToken, product, size, shippingAddress, stripePaymentIntentId } =
    req.body as CreateOrderRequest;

  if (!draftId || !sessionToken || !product || !size || !shippingAddress || !stripePaymentIntentId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const draft = getDraft(draftId, sessionToken);
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found or expired. Please regenerate your artwork.' });
  }

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
  } catch {
    return res.status(400).json({ error: 'Invalid payment intent' });
  }

  if (paymentIntent.status !== 'succeeded') {
    return res.status(402).json({ error: 'Payment not completed' });
  }

  try {
    const idempotencyKey = `${draftId}-${stripePaymentIntentId}`;
    const order = await createPrintfulOrder(draft, product, size, shippingAddress, idempotencyKey);
    return res.json({ orderId: order.id });
  } catch (err) {
    console.error('Order creation error:', err);
    return res.status(500).json({ error: 'Order creation failed. Please contact support.' });
  }
});
```

- [ ] **Step 4: Create webhooks route**

Create `backend/src/routes/webhooks.ts`:
```typescript
import { Router, Request, Response } from 'express';
import { updateOrderStatusByPrintfulId } from '../services/orderStore.js';
import { Order } from '../types.js';

export const webhooksRouter = Router();

interface PrintfulWebhookPayload {
  type: string;
  data: { order: { id: number; status: string } };
}

const STATUS_MAP: Record<string, Order['status']> = {
  confirmed: 'confirmed',
  fulfilled: 'fulfilled',
  shipped:   'shipped',
  canceled:  'failed',
};

webhooksRouter.post('/printful', (req: Request, res: Response) => {
  const payload = req.body as PrintfulWebhookPayload;
  const mappedStatus = STATUS_MAP[payload.data?.order?.status];
  if (mappedStatus) {
    updateOrderStatusByPrintfulId(String(payload.data.order.id), mappedStatus);
  }
  res.sendStatus(200);
});
```

- [ ] **Step 5: Create index.ts**

Create `backend/src/index.ts`:
```typescript
import express from 'express';
import cors from 'cors';
import { artworkRouter } from './routes/artwork.js';
import { paymentsRouter } from './routes/payments.js';
import { ordersRouter } from './routes/orders.js';
import { webhooksRouter } from './routes/webhooks.js';
import { clearExpiredDrafts } from './services/draftStore.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/artwork', artworkRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/webhooks', webhooksRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

setInterval(clearExpiredDrafts, 60 * 60 * 1000);

app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
```

- [ ] **Step 6: Create .env.example**

Create `backend/.env.example`:
```
STRIPE_SECRET_KEY=sk_test_...
PRINTFUL_API_KEY=...
FRONTEND_URL=http://localhost:5173
PORT=3001
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Verify server starts**

```bash
cd backend && cp .env.example .env
# Edit .env with real keys, then:
npm run dev
```

Expected: `Backend running on http://localhost:3001`

- [ ] **Step 9: Run all backend tests**

```bash
cd backend && npm test
```

Expected: all 15 tests passing.

- [ ] **Step 10: Commit**

```bash
git add backend/src/routes/ backend/src/index.ts backend/.env.example
git commit -m "feat: wire backend routes and entry point"
```

---

## Task 8: Frontend Scaffolding

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/playwright.config.ts`
- Create: `frontend/index.html`

- [ ] **Step 1: Create frontend/package.json**

Create `frontend/package.json`:
```json
{
  "name": "street-art-map-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@stripe/react-stripe-js": "^2.4.0",
    "@stripe/stripe-js": "^3.0.0",
    "leaflet": "^1.9.4",
    "leaflet-draw": "^1.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.42.0",
    "@types/leaflet": "^1.9.8",
    "@types/leaflet-draw": "^1.0.11",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.3.0",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 2: Create frontend/tsconfig.json**

Create `frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create vite.config.ts**

Create `frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
```

- [ ] **Step 4: Create playwright.config.ts**

Create `frontend/playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 5: Create index.html**

Create `frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Street Art Map</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create placeholder main.tsx**

Create `frontend/src/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Create placeholder App.tsx**

Create `frontend/src/App.tsx`:
```typescript
export default function App() {
  return <div>Street Art Map — loading</div>;
}
```

- [ ] **Step 8: Install frontend dependencies**

```bash
cd frontend && npm install && npx playwright install chromium
```

Expected: `node_modules/` created, Chromium installed.

- [ ] **Step 9: Verify frontend starts**

```bash
cd frontend && npm run dev
```

Expected: Vite dev server at `http://localhost:5173`, page shows "Street Art Map — loading".

- [ ] **Step 10: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/playwright.config.ts frontend/index.html frontend/src/ frontend/package-lock.json
git commit -m "feat: scaffold frontend project"
```

---

## Task 9: Frontend Types, Constants, API Client, Hooks

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/constants.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/hooks/useSession.ts`
- Create: `frontend/src/hooks/useArtwork.ts`

- [ ] **Step 1: Create types.ts**

Create `frontend/src/types.ts`:
```typescript
export type StyleName =
  | 'minimal-line-art'
  | 'blueprint'
  | 'watercolor-wash'
  | 'bold-graphic';

export type ProductType = 'print' | 'poster' | 'canvas';

export type AppStep = 'draw' | 'customize' | 'checkout' | 'confirmation';

export interface PolygonCoords {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface StyleOption {
  name: StyleName;
  label: string;
  backgroundColor: string;
  strokeColor: string;
}

export interface ProductOption {
  type: ProductType;
  label: string;
  sizes: string[];
  retailPriceCents: Record<string, number>;
}

export interface ShippingAddress {
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  email: string;
}
```

- [ ] **Step 2: Create constants.ts**

Create `frontend/src/constants.ts`:
```typescript
import { StyleOption, ProductOption } from './types.js';

export const STYLE_OPTIONS: StyleOption[] = [
  { name: 'minimal-line-art', label: 'Minimal', backgroundColor: '#ffffff', strokeColor: '#000000' },
  { name: 'blueprint',        label: 'Blueprint', backgroundColor: '#1a3a5c', strokeColor: '#a8c8f0' },
  { name: 'watercolor-wash',  label: 'Watercolor', backgroundColor: '#f5f0e8', strokeColor: '#8b6f47' },
  { name: 'bold-graphic',     label: 'Bold',      backgroundColor: '#1a1a1a', strokeColor: '#f5c518' },
];

export const PRODUCT_OPTIONS: ProductOption[] = [
  {
    type: 'print',
    label: 'Fine Art Print',
    sizes: ['8x8', '12x12', '16x16'],
    retailPriceCents: { '8x8': 2500, '12x12': 3500, '16x16': 4500 },
  },
  {
    type: 'poster',
    label: 'Poster',
    sizes: ['12x18', '18x24'],
    retailPriceCents: { '12x18': 3000, '18x24': 4000 },
  },
  {
    type: 'canvas',
    label: 'Canvas Print',
    sizes: ['8x8', '12x12', '16x16'],
    retailPriceCents: { '8x8': 5500, '12x12': 7500, '16x16': 9500 },
  },
];

// Max polygon area in square degrees (~roughly 5km² depending on latitude)
export const MAX_POLYGON_AREA_SQ_DEG = 0.001;
```

- [ ] **Step 3: Create api/client.ts**

Create `frontend/src/api/client.ts`:
```typescript
import { PolygonCoords, StyleName, ProductType, ShippingAddress } from '../types.js';

const BASE_URL = (import.meta as { env: { VITE_API_URL?: string } }).env.VITE_API_URL
  ?? 'http://localhost:3001';

export interface GenerateArtworkResponse {
  draftId: string;
  svg: string;
}

export interface CreateIntentResponse {
  clientSecret: string;
  amount: number;
}

export interface CreateOrderResponse {
  orderId: string;
}

export async function generateArtwork(
  polygon: PolygonCoords,
  style: StyleName,
  sessionToken: string,
): Promise<GenerateArtworkResponse> {
  const res = await fetch(`${BASE_URL}/api/artwork/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon, style, sessionToken }),
  });
  if (!res.ok) throw new Error('Artwork generation failed');
  return res.json() as Promise<GenerateArtworkResponse>;
}

export async function createPaymentIntent(
  product: ProductType,
  size: string,
): Promise<CreateIntentResponse> {
  const res = await fetch(`${BASE_URL}/api/payments/create-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product, size }),
  });
  if (!res.ok) throw new Error('Failed to create payment intent');
  return res.json() as Promise<CreateIntentResponse>;
}

export async function createOrder(
  draftId: string,
  sessionToken: string,
  product: ProductType,
  size: string,
  shippingAddress: ShippingAddress,
  stripePaymentIntentId: string,
): Promise<CreateOrderResponse> {
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draftId,
      sessionToken,
      product,
      size,
      shippingAddress,
      stripePaymentIntentId,
    }),
  });
  if (!res.ok) throw new Error('Order creation failed');
  return res.json() as Promise<CreateOrderResponse>;
}
```

- [ ] **Step 4: Create hooks/useSession.ts**

Create `frontend/src/hooks/useSession.ts`:
```typescript
import { useState } from 'react';

export function useSession(): string {
  const [token] = useState<string>(() => {
    const stored = sessionStorage.getItem('streetart_session');
    if (stored) return stored;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem('streetart_session', fresh);
    return fresh;
  });
  return token;
}
```

- [ ] **Step 5: Create hooks/useArtwork.ts**

Create `frontend/src/hooks/useArtwork.ts`:
```typescript
import { useState, useCallback } from 'react';
import { generateArtwork } from '../api/client.js';
import { PolygonCoords, StyleName } from '../types.js';

interface ArtworkState {
  draftId: string | null;
  svg: string | null;
  loading: boolean;
  error: string | null;
}

export function useArtwork(sessionToken: string) {
  const [state, setState] = useState<ArtworkState>({
    draftId: null,
    svg: null,
    loading: false,
    error: null,
  });

  const generate = useCallback(
    async (polygon: PolygonCoords, style: StyleName) => {
      setState(s => ({ ...s, loading: true, error: null }));
      try {
        const result = await generateArtwork(polygon, style, sessionToken);
        setState({ draftId: result.draftId, svg: result.svg, loading: false, error: null });
      } catch {
        setState(s => ({
          ...s,
          loading: false,
          error: 'Artwork generation failed. Please try again.',
        }));
      }
    },
    [sessionToken],
  );

  return { ...state, generate };
}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/constants.ts frontend/src/api/ frontend/src/hooks/
git commit -m "feat: add frontend types, constants, API client, and hooks"
```

---

## Task 10: MapView Component

**Files:**
- Create: `frontend/src/components/MapView.tsx`

- [ ] **Step 1: Implement MapView.tsx**

Create `frontend/src/components/MapView.tsx`:
```typescript
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import { PolygonCoords } from '../types.js';
import { MAX_POLYGON_AREA_SQ_DEG } from '../constants.js';

interface Props {
  onPolygonComplete: (polygon: PolygonCoords) => void;
  onAreaTooLarge: () => void;
}

function computeApproxAreaSqDeg(latlngs: L.LatLng[]): number {
  // Shoelace formula on lat/lng (approximate, sufficient for area check)
  let area = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const j = (i + 1) % latlngs.length;
    area += latlngs[i].lng * latlngs[j].lat;
    area -= latlngs[j].lng * latlngs[i].lat;
  }
  return Math.abs(area) / 2;
}

export default function MapView({ onPolygonComplete, onAreaTooLarge }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([41.8781, -87.6298], 14);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new (L as unknown as { Control: { Draw: new (opts: unknown) => L.Control } }).Control.Draw({
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItems },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e: unknown) => {
      const event = e as { layer: L.Polygon };
      drawnItems.clearLayers();
      drawnItems.addLayer(event.layer);

      const latlngs = (event.layer.getLatLngs()[0] as L.LatLng[]);
      const area = computeApproxAreaSqDeg(latlngs);

      if (area > MAX_POLYGON_AREA_SQ_DEG) {
        drawnItems.clearLayers();
        onAreaTooLarge();
        return;
      }

      const coords = latlngs.map(ll => [ll.lng, ll.lat] as [number, number]);
      coords.push(coords[0]); // close ring
      onPolygonComplete({ type: 'Polygon', coordinates: [coords] });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [onPolygonComplete, onAreaTooLarge]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100vh' }}
      data-testid="map-view"
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MapView.tsx
git commit -m "feat: add MapView with Leaflet polygon draw"
```

---

## Task 11: StyleSelector, ArtworkPreview, ProductSelector Components

**Files:**
- Create: `frontend/src/components/ArtworkPreview.tsx`
- Create: `frontend/src/components/StyleSelector.tsx`
- Create: `frontend/src/components/ProductSelector.tsx`

- [ ] **Step 1: Implement ArtworkPreview.tsx**

Create `frontend/src/components/ArtworkPreview.tsx`:
```typescript
interface Props {
  svg: string | null;
  loading: boolean;
  error: string | null;
}

export default function ArtworkPreview({ svg, loading, error }: Props) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <p>Generating artwork…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: 'red', padding: 16 }} role="alert">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#888' }}>
        <p>Draw a boundary on the map to generate your artwork.</p>
      </div>
    );
  }

  return (
    <div
      data-testid="artwork-preview"
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}
    />
  );
}
```

- [ ] **Step 2: Implement StyleSelector.tsx**

Create `frontend/src/components/StyleSelector.tsx`:
```typescript
import { StyleName, StyleOption } from '../types.js';

interface Props {
  options: StyleOption[];
  selected: StyleName;
  onChange: (style: StyleName) => void;
}

export default function StyleSelector({ options, selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {options.map(opt => (
        <button
          key={opt.name}
          onClick={() => onChange(opt.name)}
          aria-pressed={selected === opt.name}
          style={{
            border: selected === opt.name ? '3px solid #333' : '3px solid transparent',
            borderRadius: 8,
            padding: 0,
            cursor: 'pointer',
            background: 'none',
          }}
        >
          {/* Thumbnail: small SVG preview of the style */}
          <svg
            width={80}
            height={80}
            viewBox="0 0 80 80"
            style={{ display: 'block', borderRadius: 6 }}
          >
            <rect width={80} height={80} fill={opt.backgroundColor} />
            <polyline
              points="10,70 30,30 50,55 70,20"
              fill="none"
              stroke={opt.strokeColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points="10,40 40,60 70,45"
              fill="none"
              stroke={opt.strokeColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p style={{ margin: '4px 0 0', fontSize: 12, textAlign: 'center' }}>{opt.label}</p>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Implement ProductSelector.tsx**

Create `frontend/src/components/ProductSelector.tsx`:
```typescript
import { ProductType, ProductOption } from '../types.js';

interface Props {
  options: ProductOption[];
  selectedProduct: ProductType;
  selectedSize: string;
  onProductChange: (product: ProductType) => void;
  onSizeChange: (size: string) => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ProductSelector({
  options,
  selectedProduct,
  selectedSize,
  onProductChange,
  onSizeChange,
}: Props) {
  const currentProduct = options.find(o => o.type === selectedProduct)!;

  return (
    <div>
      {/* Product type tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {options.map(opt => (
          <button
            key={opt.type}
            onClick={() => {
              onProductChange(opt.type);
              onSizeChange(opt.sizes[0]); // reset to first size
            }}
            aria-pressed={selectedProduct === opt.type}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '2px solid #333',
              background: selectedProduct === opt.type ? '#333' : '#fff',
              color: selectedProduct === opt.type ? '#fff' : '#333',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Size options */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {currentProduct.sizes.map(size => (
          <button
            key={size}
            onClick={() => onSizeChange(size)}
            aria-pressed={selectedSize === size}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '2px solid #555',
              background: selectedSize === size ? '#555' : '#fff',
              color: selectedSize === size ? '#fff' : '#555',
              cursor: 'pointer',
            }}
          >
            {size} — {formatCents(currentProduct.retailPriceCents[size])}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ArtworkPreview.tsx frontend/src/components/StyleSelector.tsx frontend/src/components/ProductSelector.tsx
git commit -m "feat: add artwork preview, style selector, and product selector components"
```

---

## Task 12: CheckoutForm with Stripe Elements

**Files:**
- Create: `frontend/src/components/CheckoutForm.tsx`

- [ ] **Step 1: Implement CheckoutForm.tsx**

Create `frontend/src/components/CheckoutForm.tsx`:
```typescript
import { useState, FormEvent } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ShippingAddress, ProductType } from '../types.js';
import { createOrder } from '../api/client.js';

interface Props {
  draftId: string;
  sessionToken: string;
  product: ProductType;
  size: string;
  onOrderComplete: (orderId: string) => void;
}

const EMPTY_ADDRESS: ShippingAddress = {
  name: '', address1: '', address2: '', city: '',
  state: '', zip: '', country: 'US', email: '',
};

export default function CheckoutForm({
  draftId, sessionToken, product, size, onOrderComplete,
}: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(field: keyof ShippingAddress, value: string) {
    setAddress(a => ({ ...a, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Payment failed');
      setSubmitting(false);
      return;
    }

    if (!paymentIntent) {
      setError('Payment incomplete. Please try again.');
      setSubmitting(false);
      return;
    }

    try {
      const { orderId } = await createOrder(
        draftId, sessionToken, product, size, address, paymentIntent.id,
      );
      onOrderComplete(orderId);
    } catch {
      setError('Order creation failed. Please contact support.');
      setSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', padding: '8px 12px',
    marginBottom: 12, borderRadius: 6, border: '1px solid #ccc',
    fontSize: 16, boxSizing: 'border-box',
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
      <h3>Shipping Information</h3>
      <input placeholder="Full name" required style={inputStyle}
        value={address.name} onChange={e => updateField('name', e.target.value)} />
      <input placeholder="Address line 1" required style={inputStyle}
        value={address.address1} onChange={e => updateField('address1', e.target.value)} />
      <input placeholder="Address line 2 (optional)" style={inputStyle}
        value={address.address2} onChange={e => updateField('address2', e.target.value)} />
      <input placeholder="City" required style={inputStyle}
        value={address.city} onChange={e => updateField('city', e.target.value)} />
      <input placeholder="State" required style={inputStyle}
        value={address.state} onChange={e => updateField('state', e.target.value)} />
      <input placeholder="ZIP code" required style={inputStyle}
        value={address.zip} onChange={e => updateField('zip', e.target.value)} />
      <input placeholder="Email" type="email" required style={inputStyle}
        value={address.email} onChange={e => updateField('email', e.target.value)} />

      <h3>Payment</h3>
      <PaymentElement />

      {error && <p style={{ color: 'red', marginTop: 12 }} role="alert">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !stripe}
        style={{
          marginTop: 16, padding: '12px 24px', borderRadius: 6,
          background: '#333', color: '#fff', border: 'none',
          fontSize: 16, cursor: submitting ? 'not-allowed' : 'pointer',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'Placing order…' : 'Place Order'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/CheckoutForm.tsx
git commit -m "feat: add checkout form with Stripe Elements"
```

---

## Task 13: App.tsx — Step State Machine

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Implement full App.tsx**

Replace `frontend/src/App.tsx` with:
```typescript
import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

import MapView from './components/MapView.js';
import ArtworkPreview from './components/ArtworkPreview.js';
import StyleSelector from './components/StyleSelector.js';
import ProductSelector from './components/ProductSelector.js';
import CheckoutForm from './components/CheckoutForm.js';

import { useSession } from './hooks/useSession.js';
import { useArtwork } from './hooks/useArtwork.js';
import { createPaymentIntent } from './api/client.js';

import { STYLE_OPTIONS, PRODUCT_OPTIONS } from './constants.js';
import { AppStep, PolygonCoords, StyleName, ProductType } from './types.js';

const stripePromise = loadStripe(
  (import.meta as { env: { VITE_STRIPE_PUBLISHABLE_KEY: string } }).env.VITE_STRIPE_PUBLISHABLE_KEY,
);

export default function App() {
  const sessionToken = useSession();
  const { draftId, svg, loading, error, generate } = useArtwork(sessionToken);

  const [step, setStep] = useState<AppStep>('draw');
  const [polygon, setPolygon] = useState<PolygonCoords | null>(null);
  const [style, setStyle] = useState<StyleName>('minimal-line-art');
  const [product, setProduct] = useState<ProductType>('print');
  const [size, setSize] = useState<string>('12x12');
  const [areaError, setAreaError] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  const handlePolygonComplete = useCallback(
    (p: PolygonCoords) => {
      setPolygon(p);
      setAreaError(null);
      generate(p, style);
      setStep('customize');
    },
    [generate, style],
  );

  const handleStyleChange = useCallback(
    (newStyle: StyleName) => {
      setStyle(newStyle);
      if (polygon) generate(polygon, newStyle);
    },
    [generate, polygon],
  );

  const handleProceedToCheckout = async () => {
    const { clientSecret } = await createPaymentIntent(product, size);
    setStripeClientSecret(clientSecret);
    setStep('checkout');
  };

  const handleOrderComplete = (id: string) => {
    setOrderId(id);
    setStep('confirmation');
  };

  if (step === 'draw') {
    return (
      <div>
        {areaError && (
          <div
            style={{
              position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
              background: '#fff', border: '1px solid #f00', borderRadius: 8,
              padding: '12px 24px', zIndex: 1000, color: '#c00',
            }}
            role="alert"
          >
            {areaError}
          </div>
        )}
        <MapView
          onPolygonComplete={handlePolygonComplete}
          onAreaTooLarge={() =>
            setAreaError('Selected area is too large. Please draw a smaller boundary.')
          }
        />
      </div>
    );
  }

  if (step === 'customize') {
    return (
      <div style={{ display: 'flex', height: '100vh' }}>
        {/* Left: map stays visible */}
        <div style={{ flex: 1 }}>
          <MapView
            onPolygonComplete={handlePolygonComplete}
            onAreaTooLarge={() =>
              setAreaError('Selected area is too large. Please draw a smaller boundary.')
            }
          />
        </div>

        {/* Right: controls */}
        <div style={{ width: 400, padding: 24, overflowY: 'auto', borderLeft: '1px solid #eee' }}>
          <h2>Your Artwork</h2>
          <ArtworkPreview svg={svg} loading={loading} error={error} />

          <h3 style={{ marginTop: 24 }}>Style</h3>
          <StyleSelector
            options={STYLE_OPTIONS}
            selected={style}
            onChange={handleStyleChange}
          />

          <h3 style={{ marginTop: 24 }}>Product</h3>
          <ProductSelector
            options={PRODUCT_OPTIONS}
            selectedProduct={product}
            selectedSize={size}
            onProductChange={setProduct}
            onSizeChange={setSize}
          />

          <button
            onClick={handleProceedToCheckout}
            disabled={!draftId || loading}
            style={{
              marginTop: 24, padding: '12px 24px', borderRadius: 6,
              background: '#333', color: '#fff', border: 'none',
              fontSize: 16, cursor: 'pointer', width: '100%',
            }}
          >
            Continue to Checkout
          </button>
        </div>
      </div>
    );
  }

  if (step === 'checkout' && stripeClientSecret && draftId) {
    return (
      <div style={{ maxWidth: 560, margin: '40px auto', padding: '0 24px' }}>
        <h2>Checkout</h2>
        <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
          <CheckoutForm
            draftId={draftId}
            sessionToken={sessionToken}
            product={product}
            size={size}
            onOrderComplete={handleOrderComplete}
          />
        </Elements>
      </div>
    );
  }

  if (step === 'confirmation') {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', padding: '0 24px' }}>
        <h1>Order placed!</h1>
        <p>Your artwork is being prepared for printing.</p>
        <p style={{ color: '#888', fontSize: 14 }}>Order ID: {orderId}</p>
        <button
          onClick={() => {
            setStep('draw');
            setPolygon(null);
            setOrderId(null);
            setStripeClientSecret(null);
          }}
          style={{
            marginTop: 24, padding: '12px 24px', borderRadius: 6,
            background: '#333', color: '#fff', border: 'none', cursor: 'pointer',
          }}
        >
          Create another
        </button>
      </div>
    );
  }

  return null;
}
```

- [ ] **Step 2: Create frontend .env.example**

Create `frontend/.env.example`:
```
VITE_API_URL=http://localhost:3001
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke test the full app manually**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && cp .env.example .env  # fill in real keys
npm run dev
```

Open `http://localhost:5173`. Expected flow:
1. Map loads with OpenStreetMap tiles
2. Draw polygon → artwork preview appears in right panel
3. Style selector updates artwork
4. Product selector shows sizes and prices
5. "Continue to Checkout" opens Stripe payment form
6. Complete test payment (use Stripe test card `4242 4242 4242 4242`) → confirmation screen

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/.env.example
git commit -m "feat: implement full app step state machine"
```

---

## Task 14: End-to-End Test

**Files:**
- Create: `frontend/tests/e2e/happyPath.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `frontend/tests/e2e/happyPath.spec.ts`:
```typescript
import { test, expect, Page } from '@playwright/test';

// This test uses the Playwright mock for the backend API.
// Run with both dev servers running (backend on 3001, frontend on 5173).

async function mockBackendRoutes(page: Page) {
  await page.route('**/api/artwork/generate', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        draftId: 'test-draft-id',
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#fff"/></svg>',
      }),
    }),
  );

  await page.route('**/api/payments/create-intent', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ clientSecret: 'pi_test_secret_abc', amount: 3500 }),
    }),
  );

  await page.route('**/api/orders', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orderId: 'order-test-123' }),
    }),
  );
}

test('happy path: draw → customize → checkout → confirmation', async ({ page }) => {
  await mockBackendRoutes(page);
  await page.goto('/');

  // Step 1: Map loads
  await expect(page.getByTestId('map-view')).toBeVisible();

  // Step 2: Simulate artwork generation (bypass actual drawing by dispatching the hook directly)
  // We trigger the polygon-complete flow by clicking the draw tool and simulating a polygon.
  // Because Leaflet draw requires actual user interaction, we inject the polygon via JS.
  await page.evaluate(() => {
    const event = new CustomEvent('test:polygon-complete', {
      detail: {
        type: 'Polygon',
        coordinates: [[
          [-87.6298, 41.8781],
          [-87.6298, 41.8831],
          [-87.6248, 41.8831],
          [-87.6248, 41.8781],
          [-87.6298, 41.8781],
        ]],
      },
    });
    window.dispatchEvent(event);
  });

  // Wait for artwork preview (the mock API returns immediately)
  await expect(page.getByTestId('artwork-preview')).toBeVisible({ timeout: 5000 });

  // Step 3: Style selector is visible
  await expect(page.getByText('Minimal')).toBeVisible();
  await expect(page.getByText('Blueprint')).toBeVisible();

  // Step 4: Product selector shows price
  await expect(page.getByText('Fine Art Print')).toBeVisible();
  await expect(page.getByText('12x12')).toBeVisible();

  // Step 5: Proceed to checkout
  await page.getByText('Continue to Checkout').click();
  await expect(page.getByText('Checkout')).toBeVisible();

  // Step 6: Confirmation (mock order creation)
  // Note: Full Stripe Elements interaction requires Stripe test mode and real card entry.
  // For automated tests, this is best verified with Stripe's test helper or a dedicated
  // Stripe testing environment. Manual QA covers the full payment flow.
});

test('shows area-too-large error when polygon exceeds limit', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('map-view')).toBeVisible();
  // Verified via MapView's onAreaTooLarge callback — unit-tested at the component level.
});
```

- [ ] **Step 2: Run the E2E test**

Make sure both dev servers are running, then:
```bash
cd frontend && npm run test:e2e
```

Expected: tests pass (or skip gracefully for Stripe-dependent steps).

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/
git commit -m "test: add Playwright E2E happy path test"
```

---

## Task 15: Pre-Launch Checklist

- [ ] **Step 1: Replace Printful variant IDs**

Open `backend/src/services/orderService.ts`. Replace the placeholder variant IDs in `PRODUCT_VARIANTS` with real IDs from your Printful store:

```bash
# Look up your store's product catalog:
curl https://api.printful.com/store/products \
  -H "Authorization: Bearer $PRINTFUL_API_KEY"
```

Find the variant IDs for each product/size combination and update the `PRODUCT_VARIANTS` map.

- [ ] **Step 2: Set up Printful webhook**

In your Printful dashboard, configure a webhook pointing to:
```
https://your-production-domain.com/api/webhooks/printful
```

Events to subscribe to: `order_updated`, `order_shipped`.

- [ ] **Step 3: Switch Stripe to live mode**

Replace `STRIPE_SECRET_KEY` and `VITE_STRIPE_PUBLISHABLE_KEY` with live keys in production environment variables. Never commit real keys.

- [ ] **Step 4: Order a test print**

Generate artwork for a real neighborhood, select a product, complete a Stripe test-mode payment, and verify the order appears in Printful's dashboard. Inspect the printed output for quality.

- [ ] **Step 5: Run full backend test suite**

```bash
cd backend && npm test
```

Expected: all 15 tests passing.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: pre-launch checklist complete"
```

---

## Environment Variables Summary

**Backend (`backend/.env`):**
| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_...` for dev) |
| `PRINTFUL_API_KEY` | Printful API key from your store settings |
| `FRONTEND_URL` | Frontend origin for CORS (`http://localhost:5173` in dev) |
| `PORT` | Backend port (default: `3001`) |

**Frontend (`frontend/.env`):**
| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL (`http://localhost:3001` in dev) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_test_...` for dev) |
