# Land/Water Rendering & Polygon Clipping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render large water bodies (oceans, Lake Michigan) correctly by switching to a land-over-water model, and clip all SVG content to the user's drawn polygon shape.

**Architecture:** Bundle Natural Earth 1:10m land GeoJSON in the backend. At generate time, intersect land features with the drawn polygon to get `LandRing[]`. `generateSvg` renders a water-colored background inside the clip group, land polygons over it, then water bodies, then roads — all clipped to the drawn polygon via SVG `<clipPath>`. The bounding box is derived from the drawn polygon (not streets) so the coordinate space is stable.

**Tech Stack:** TypeScript, Express, `polygon-clipping` (geometry intersection), Natural Earth GeoJSON, SVG `<clipPath>`

---

## File Map

| File | Change |
|------|--------|
| `backend/src/types.ts` | Add `LandRing` type |
| `backend/src/data/ne_10m_land.json` | New — Natural Earth 1:10m land GeoJSON (downloaded) |
| `backend/src/data/landData.ts` | New — loads land data at startup, exports `fetchLandGeometry` |
| `backend/tests/unit/landData.test.ts` | New — unit tests for `fetchLandGeometry` using fixture data |
| `backend/src/services/artEngine.ts` | Add `getBoundingBoxFromPolygon`, `renderLandBodies`, `renderClipPath`; update `generateSvg` |
| `backend/tests/unit/artEngine.test.ts` | Add tests for new layers and clip path; update existing calls |
| `backend/src/routes/artwork.ts` | Add `fetchLandGeometry` to `Promise.all`; pass `landRings` + `polygon` to `generateSvg` |
| `frontend/src/App.tsx` | Update `applyStreetStyle` to target `rect.water-bg` |

---

### Task 1: Add `LandRing` type and install `polygon-clipping`

**Files:**
- Modify: `backend/src/types.ts`

- [ ] **Step 1: Append `LandRing` to `backend/src/types.ts`**

Add after the `WaterRing` line at the bottom of the file:

```typescript
// A single closed ring of [lng, lat] coordinate pairs describing a land mass outline.
export type LandRing = [number, number][];
```

- [ ] **Step 2: Install `polygon-clipping`**

```bash
cd backend && npm install polygon-clipping
```

`polygon-clipping` ships its own TypeScript types — no separate `@types` package needed.

- [ ] **Step 3: Verify TypeScript can import it**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/types.ts backend/package.json backend/package-lock.json
git commit -m "feat: add LandRing type and install polygon-clipping"
```

---

### Task 2: Download Natural Earth land data

**Files:**
- Create: `backend/src/data/ne_10m_land.json`

- [ ] **Step 1: Create the data directory**

```bash
mkdir -p backend/src/data
```

- [ ] **Step 2: Download the Natural Earth 1:10m land GeoJSON**

```bash
curl -L "https://github.com/nvkelso/natural-earth-vector/raw/master/geojson/ne_10m_land.geojson" \
  -o backend/src/data/ne_10m_land.json
```

Expected: file is ~3–5 MB. Verify it starts with `{"type":"FeatureCollection"`:

```bash
head -c 100 backend/src/data/ne_10m_land.json
```

Expected output (approximately): `{"type":"FeatureCollection","features":[{"type":"Feature","properties":{...`

- [ ] **Step 3: Verify feature count**

```bash
node -e "const d = JSON.parse(require('fs').readFileSync('backend/src/data/ne_10m_land.json','utf8')); console.log('features:', d.features.length);"
```

Expected: `features: 127` (or similar, at least 100). Each feature is a `Polygon` or `MultiPolygon` representing a land mass.

- [ ] **Step 4: Add to .gitignore or commit directly**

The file is ~3–5 MB. Either commit it directly (acceptable for a data asset) or add it to `.gitignore` and document the download step. Commit directly unless the repo already excludes large files:

```bash
git add backend/src/data/ne_10m_land.json
git commit -m "data: bundle Natural Earth 1:10m land polygons"
```

---

### Task 3: Create `landData.ts` with TDD

**Files:**
- Create: `backend/src/data/landData.ts`
- Create: `backend/tests/unit/landData.test.ts`

- [ ] **Step 1: Write failing tests — create `backend/tests/unit/landData.test.ts`**

```typescript
import { _fetchLandGeometryFromFeatures } from '../../src/data/landData.js';
import { GeoJSONPolygon } from '../../src/types.js';

// A simple square land mass: lon 0–10, lat 10–20 (mid-Atlantic / Africa region)
const mockFeatures = [
  {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[0, 10], [10, 10], [10, 20], [0, 20], [0, 10]]],
    },
    properties: {},
  },
];

// Drawn polygon entirely inside the mock land square
const drawnOverLand: GeoJSONPolygon = {
  type: 'Polygon',
  coordinates: [[[2, 12], [8, 12], [8, 18], [2, 18], [2, 12]]],
};

// Drawn polygon entirely outside — no overlap
const drawnOverOcean: GeoJSONPolygon = {
  type: 'Polygon',
  coordinates: [[[30, 30], [40, 30], [40, 40], [30, 40], [30, 30]]],
};

// Drawn polygon straddling the left edge of the land square (lon -5 to 5)
const drawnStraddling: GeoJSONPolygon = {
  type: 'Polygon',
  coordinates: [[[-5, 12], [5, 12], [5, 18], [-5, 18], [-5, 12]]],
};

describe('_fetchLandGeometryFromFeatures', () => {
  it('returns rings when drawn polygon is entirely inside a land feature', () => {
    const rings = _fetchLandGeometryFromFeatures(mockFeatures, drawnOverLand);
    expect(rings.length).toBeGreaterThan(0);
    // Every coordinate in every ring should be within or on the boundary of drawnOverLand
    for (const ring of rings) {
      for (const [lng] of ring) {
        expect(lng).toBeGreaterThanOrEqual(2);
        expect(lng).toBeLessThanOrEqual(8);
      }
    }
  });

  it('returns empty array when drawn polygon does not intersect any land feature', () => {
    const rings = _fetchLandGeometryFromFeatures(mockFeatures, drawnOverOcean);
    expect(rings).toEqual([]);
  });

  it('returns clipped ring when drawn polygon straddles a land boundary', () => {
    const rings = _fetchLandGeometryFromFeatures(mockFeatures, drawnStraddling);
    expect(rings.length).toBeGreaterThan(0);
    // All returned coordinates must have lng >= 0 (the land boundary)
    for (const ring of rings) {
      for (const [lng] of ring) {
        expect(lng).toBeGreaterThanOrEqual(0 - 0.0001); // allow float epsilon
      }
    }
  });

  it('returns rings from MultiPolygon land features', () => {
    const multiFeature = [
      {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[0, 10], [10, 10], [10, 20], [0, 20], [0, 10]]],
            [[[20, 10], [30, 10], [30, 20], [20, 20], [20, 10]]],
          ],
        },
        properties: {},
      },
    ];
    const rings = _fetchLandGeometryFromFeatures(multiFeature, drawnOverLand);
    expect(rings.length).toBeGreaterThan(0);
  });

  it('returns empty array when features array is empty', () => {
    const rings = _fetchLandGeometryFromFeatures([], drawnOverLand);
    expect(rings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npx jest tests/unit/landData.test.ts
```

Expected: FAIL — `_fetchLandGeometryFromFeatures` not found (module does not exist yet).

- [ ] **Step 3: Create `backend/src/data/landData.ts`**

```typescript
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon } from 'polygon-clipping';
import { GeoJSONPolygon, LandRing } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rawData = JSON.parse(
  readFileSync(join(__dirname, 'ne_10m_land.json'), 'utf-8'),
);

interface LandFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: unknown;
  };
}

const landFeatures: LandFeature[] = rawData.features;

function bboxOverlaps(
  feature: LandFeature,
  polygon: GeoJSONPolygon,
): boolean {
  const pCoords = polygon.coordinates[0];
  const pLngs = pCoords.map(([lng]) => lng);
  const pLats = pCoords.map(([, lat]) => lat);
  const pMinLng = Math.min(...pLngs), pMaxLng = Math.max(...pLngs);
  const pMinLat = Math.min(...pLats), pMaxLat = Math.max(...pLats);

  // Extract all coordinates from Polygon or MultiPolygon
  const geoCoords: number[][][] =
    feature.geometry.type === 'Polygon'
      ? (feature.geometry.coordinates as number[][][])
      : (feature.geometry.coordinates as number[][][][]).flat(1);

  let fMinLng = Infinity, fMaxLng = -Infinity;
  let fMinLat = Infinity, fMaxLat = -Infinity;
  for (const ring of geoCoords) {
    for (const [lng, lat] of ring) {
      if (lng < fMinLng) fMinLng = lng;
      if (lng > fMaxLng) fMaxLng = lng;
      if (lat < fMinLat) fMinLat = lat;
      if (lat > fMaxLat) fMaxLat = lat;
    }
  }

  return !(fMaxLng < pMinLng || fMinLng > pMaxLng || fMaxLat < pMinLat || fMinLat > pMaxLat);
}

function intersectFeatureWithPolygon(
  feature: LandFeature,
  drawnPolygon: GeoJSONPolygon,
): LandRing[] {
  // polygon-clipping expects MultiPolygon coordinate format: Polygon[]
  // where Polygon = Ring[] and Ring = [number, number][]
  const drawn: MultiPolygon = [drawnPolygon.coordinates as unknown as Polygon];

  let landCoords: MultiPolygon;
  if (feature.geometry.type === 'Polygon') {
    landCoords = [feature.geometry.coordinates as unknown as Polygon];
  } else if (feature.geometry.type === 'MultiPolygon') {
    landCoords = feature.geometry.coordinates as unknown as MultiPolygon;
  } else {
    return [];
  }

  let result: MultiPolygon;
  try {
    result = polygonClipping.intersection(drawn, landCoords);
  } catch {
    return [];
  }

  // From each intersected polygon, take only the outer ring (index 0)
  return result.map(poly => poly[0] as LandRing);
}

// Exported for testing with fixture data (not for external production use)
export function _fetchLandGeometryFromFeatures(
  features: LandFeature[],
  polygon: GeoJSONPolygon,
): LandRing[] {
  const rings: LandRing[] = [];
  for (const feature of features) {
    if (!bboxOverlaps(feature, polygon)) continue;
    rings.push(...intersectFeatureWithPolygon(feature, polygon));
  }
  return rings.filter(ring => ring.length >= 3);
}

export function fetchLandGeometry(polygon: GeoJSONPolygon): LandRing[] {
  return _fetchLandGeometryFromFeatures(landFeatures, polygon);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && npx jest tests/unit/landData.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Run full test suite to confirm nothing broke**

```bash
cd backend && npx jest
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/data/landData.ts backend/tests/unit/landData.test.ts
git commit -m "feat: land geometry module with Natural Earth intersection and tests"
```

---

### Task 4: Update `artEngine.ts` with new rendering layers and clip path

**Files:**
- Modify: `backend/src/services/artEngine.ts`
- Modify: `backend/tests/unit/artEngine.test.ts`

The existing `generateSvg` tests use the old 2–5 arg signature (no polygon). To preserve backward compat, `drawnPolygon` is added as an optional 7th parameter. When absent, the old code path runs (bbox from streets, no clip path, no land bodies, no water-bg rect).

- [ ] **Step 1: Write failing tests — append to `backend/tests/unit/artEngine.test.ts`**

First, update the import line at the top of the file (line 2) to include `LandRing` and `GeoJSONPolygon`:

```typescript
import { generateSvg } from '../../src/services/artEngine.js';
import { GeoJSONFeatureCollection, WaterRing, LandRing, GeoJSONPolygon } from '../../src/types.js';
```

Then append the new describe block at the end of the file:

```typescript
describe('generateSvg with drawn polygon (land/water/clip)', () => {
  // A polygon that wraps tightly around the sample street data (Chicago area)
  const samplePolygon: GeoJSONPolygon = {
    type: 'Polygon',
    coordinates: [[
      [-87.640, 41.870],
      [-87.620, 41.870],
      [-87.620, 41.890],
      [-87.640, 41.890],
      [-87.640, 41.870],
    ]],
  };

  const sampleLand: LandRing[] = [
    [
      [-87.640, 41.870],
      [-87.620, 41.870],
      [-87.620, 41.890],
      [-87.640, 41.890],
      [-87.640, 41.870],
    ],
  ];

  const sampleWater: WaterRing[] = [
    [
      [-87.635, 41.875],
      [-87.625, 41.875],
      [-87.625, 41.885],
      [-87.635, 41.885],
      [-87.635, 41.875],
    ],
  ];

  it('includes <clipPath id="frame"> in defs when drawnPolygon provided', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, {}, [], [], samplePolygon);
    expect(svg).toContain('<clipPath id="frame">');
  });

  it('includes rect.canvas-bg and rect.water-bg when drawnPolygon provided', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, {}, [], [], samplePolygon);
    expect(svg).toContain('class="canvas-bg"');
    expect(svg).toContain('class="water-bg"');
  });

  it('canvas-bg uses preset backgroundColor and water-bg uses WATER_DEFAULT_FILL', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, {}, [], [], samplePolygon);
    // canvas-bg should have the style background color (white for minimal-line-art)
    expect(svg).toMatch(/class="canvas-bg"[^>]*fill="#ffffff"/);
    // water-bg should have the default water fill
    expect(svg).toMatch(/class="water-bg"[^>]*fill="#bfbfbf"/);
  });

  it('wraps road paths in <g clip-path="url(#frame)">', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, {}, [], [], samplePolygon);
    expect(svg).toContain('clip-path="url(#frame)"');
    // The clip group must appear before the road paths
    const clipIdx = svg.indexOf('clip-path="url(#frame)"');
    const roadIdx = svg.indexOf('class="road-');
    expect(clipIdx).toBeLessThan(roadIdx);
  });

  it('renders land paths before water paths before road paths', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, {}, sampleWater, sampleLand, samplePolygon);
    const landIdx = svg.indexOf('class="land-body"');
    const waterIdx = svg.indexOf('class="water-body"');
    const roadIdx = svg.indexOf('class="road-');
    expect(landIdx).toBeGreaterThanOrEqual(0);
    expect(waterIdx).toBeGreaterThanOrEqual(0);
    expect(roadIdx).toBeGreaterThanOrEqual(0);
    expect(landIdx).toBeLessThan(waterIdx);
    expect(waterIdx).toBeLessThan(roadIdx);
  });

  it('land paths use preset backgroundColor as fill', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, {}, [], sampleLand, samplePolygon);
    expect(svg).toContain('class="land-body"');
    expect(svg).toContain('fill="#ffffff"'); // minimal-line-art backgroundColor
  });

  it('old signature (no polygon) still works — no clipPath, no canvas-bg/water-bg', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art');
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<clipPath');
    expect(svg).not.toContain('canvas-bg');
    expect(svg).not.toContain('water-bg');
  });
});
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
cd backend && npx jest tests/unit/artEngine.test.ts
```

Expected: the new `generateSvg with drawn polygon` tests FAIL — `generateSvg` doesn't accept a 7th argument yet.

- [ ] **Step 3: Update `artEngine.ts` imports (line 1)**

```typescript
import { GeoJSONFeatureCollection, GeoJSONPolygon, StyleName, StylePreset, WaterRing, LandRing } from '../types.js';
```

- [ ] **Step 4: Add `getBoundingBoxFromPolygon` after the existing `getBoundingBox` function**

Insert this function immediately after the closing `}` of `getBoundingBox` (after line 31 in the current file):

```typescript
function getBoundingBoxFromPolygon(polygon: GeoJSONPolygon): BoundingBox {
  const coords = polygon.coordinates[0];
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}
```

- [ ] **Step 5: Add `renderLandBodies` function after `renderWaterBodies`**

Insert immediately after the closing `}` of `renderWaterBodies`:

```typescript
function renderLandBodies(
  landRings: LandRing[],
  bbox: BoundingBox,
  preset: StylePreset,
): string {
  if (landRings.length === 0) return '';
  return landRings
    .map(ring => {
      const pts = ring.map(([lng, lat]) => toSvgCoords(lng, lat, bbox, preset.padding));
      if (pts.length < 3) return '';
      const d = `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
      return `    <path class="land-body" d="${d}" fill="${preset.backgroundColor}" stroke="none"/>`;
    })
    .filter(Boolean)
    .join('\n');
}
```

- [ ] **Step 6: Add `renderClipPath` function after `renderLandBodies`**

```typescript
function renderClipPath(polygon: GeoJSONPolygon, bbox: BoundingBox, padding: number): string {
  const pts = polygon.coordinates[0].map(([lng, lat]) => toSvgCoords(lng, lat, bbox, padding));
  const d = `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
  return `    <clipPath id="frame">\n      <path d="${d}"/>\n    </clipPath>`;
}
```

- [ ] **Step 7: Replace the `generateSvg` function with the updated version**

Replace the entire `export function generateSvg(...)` function:

```typescript
export function generateSvg(
  streetData: GeoJSONFeatureCollection,
  style: StyleName,
  labelOffset = LABEL_DEFAULT_OFFSET_PX,
  groupMap: Record<string, string> = {},
  waterRings: WaterRing[] = [],
  landRings: LandRing[] = [],
  drawnPolygon?: GeoJSONPolygon,
): string {
  if (streetData.features.length === 0) {
    throw new Error('No street data to render');
  }
  const preset = getStylePreset(style);

  if (drawnPolygon) {
    const bbox = getBoundingBoxFromPolygon(drawnPolygon);
    const clipPath = renderClipPath(drawnPolygon, bbox, preset.padding);
    const land = renderLandBodies(landRings, bbox, preset);
    const water = renderWaterBodies(waterRings, bbox, preset);
    const paths = renderPaths(streetData.features, bbox, preset, groupMap);
    const labels = renderStreetLabels(streetData.features, bbox, preset, labelOffset);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <defs>
${clipPath}
  </defs>
  <rect class="canvas-bg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${preset.backgroundColor}"/>
  <g clip-path="url(#frame)">
    <rect class="water-bg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${WATER_DEFAULT_FILL}"/>
${land ? land + '\n' : ''}${water ? water + '\n' : ''}${paths}
${labels}
  </g>
</svg>`;
  }

  // Legacy path — no polygon provided (used by existing tests and backward-compat callers)
  const bbox = getBoundingBox(streetData.features);
  const water = renderWaterBodies(waterRings, bbox, preset);
  const paths = renderPaths(streetData.features, bbox, preset, groupMap);
  const labels = renderStreetLabels(streetData.features, bbox, preset, labelOffset);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${preset.backgroundColor}"/>
${water ? water + '\n' : ''}${paths}
${labels}
</svg>`;
}
```

- [ ] **Step 8: Run all artEngine tests**

```bash
cd backend && npx jest tests/unit/artEngine.test.ts
```

Expected: all tests PASS (both old tests and new `generateSvg with drawn polygon` tests).

- [ ] **Step 9: Run the full test suite**

```bash
cd backend && npx jest
```

Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add backend/src/services/artEngine.ts backend/tests/unit/artEngine.test.ts
git commit -m "feat: land bodies, clip path, and polygon-anchored bbox in artEngine"
```

---

### Task 5: Update `artwork.ts` route to include land geometry

**Files:**
- Modify: `backend/src/routes/artwork.ts`

- [ ] **Step 1: Replace `backend/src/routes/artwork.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { fetchStreetGeometry, fetchWaterGeometry } from '../services/geometryService.js';
import { fetchLandGeometry } from '../data/landData.js';
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
    const { highwayTypes, labelOffset, groupMap } = req.body as GenerateArtworkRequest;

    const [streetData, waterRings] = await Promise.all([
      fetchStreetGeometry(polygon),
      fetchWaterGeometry(polygon),
    ]);

    // fetchLandGeometry is synchronous — no need to include in Promise.all
    const landRings = fetchLandGeometry(polygon);

    const filtered = highwayTypes?.length
      ? { ...streetData, features: streetData.features.filter(f => highwayTypes.includes(f.properties['highway'] as string)) }
      : streetData;

    if (filtered.features.length === 0) {
      return res.status(400).json({ error: 'No streets of the selected types found in this area. Try enabling more street types.' });
    }

    const svg = generateSvg(filtered, style, labelOffset, groupMap ?? {}, waterRings, landRings, polygon);
    const draft = saveDraft(sessionToken, polygon, style, svg);
    const response: GenerateArtworkResponse = { draftId: draft.id, svg };
    return res.json(response);
  } catch (err) {
    console.error('Artwork generation error:', err);
    return res.status(500).json({ error: 'Artwork generation failed. Please try again.' });
  }
});
```

- [ ] **Step 2: Run all backend tests**

```bash
cd backend && npx jest
```

Expected: all tests PASS.

- [ ] **Step 3: TypeScript compile check**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/artwork.ts
git commit -m "feat: include land rings in artwork generation route"
```

---

### Task 6: Update `App.tsx` CSS injection to target `rect.water-bg`

**Files:**
- Modify: `frontend/src/App.tsx`

Currently `applyStreetStyle` injects `path.water-body{fill:...}`. The new SVG has a `rect.water-bg` inside the clip group that also needs to be water-colored. Update the injected `<style>` to target both.

- [ ] **Step 1: Find the CSS injection line in `applyStreetStyle` (around line 92 of `App.tsx`)**

Current line:
```typescript
const style = `<style>path.water-body{fill:${waterColor};}${groupRules}text{${textRules};}</style>`;
```

Replace with:
```typescript
const style = `<style>rect.water-bg{fill:${waterColor};}path.water-body{fill:${waterColor};}${groupRules}text{${textRules};}</style>`;
```

- [ ] **Step 2: Verify the frontend builds**

```bash
cd frontend && npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: extend water color CSS injection to target rect.water-bg"
```

---

### Task 7: Manual smoke test

- [ ] **Step 1: Start backend and frontend dev servers**

In one terminal:
```bash
cd backend && npm run dev
```

In another:
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Test inland city — confirm no water artifacts**

1. Open `http://localhost:5173`
2. Draw a polygon over an inland area (e.g., central Denver, CO — roughly 39.7°N, 104.9°W)
3. Expected: artwork generates normally, no stray gray water areas, roads visible

- [ ] **Step 3: Test coastal city — confirm ocean renders correctly**

1. Draw a polygon over the Chicago lakefront (42.35°N, 87.65°W) — should straddle land and Lake Michigan
2. Expected: Lake Michigan appears as the water color (default gray), the land area shows the style's background color, roads appear over land

- [ ] **Step 4: Test water color picker**

1. With a coastal polygon loaded, go to Streets tab
2. Change the water color picker
3. Expected: both the lake/ocean background AND any river/pond paths update instantly (no spinner, no network request)

- [ ] **Step 5: Test polygon clipping**

1. Draw a polygon that includes a road that clearly extends beyond the drawn boundary on the preview map
2. Expected: in the generated artwork, the road is clipped at the polygon edge — no roads visible outside the drawn shape

- [ ] **Step 6: Confirm SVG export respects clip path**

1. Generate an artwork with a coastal area
2. Open the export/download (or inspect the SVG source in browser devtools)
3. Expected: SVG contains `<clipPath id="frame">` and `<g clip-path="url(#frame)">` wrapping all content
