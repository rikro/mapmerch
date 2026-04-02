# Land/Water Rendering & Polygon Clipping Design

**Date:** 2026-04-01  
**Status:** Approved

## Problem

1. **Large water bodies render incorrectly.** The current Overpass water query only returns OSM features whose geometry intersects the drawn polygon. For large bodies (Lake Michigan, oceans, seas), member ways mostly fall *outside* any drawn area, so Overpass returns nothing and the water appears as background color.

2. **Roads and water are not clipped to the drawn boundary.** Overpass returns full ways that cross the boundary edge — the portion extending outside the polygon is still rendered. For roads this produces lines that bleed past the user's shape; for water this is an additional source of incorrect geometry.

## Solution

Flip the rendering model: treat everything as water by default, paint land on top, then clip the entire output to the user's drawn polygon.

**Rendering stack (bottom to top):**
1. `<rect>` — water background (fills canvas with water color)
2. `<g clip-path="url(#frame)">` — wraps all layers below
3. Land polygons (Natural Earth 1:10m) clipped to drawn polygon
4. Overpass water bodies (rivers, ponds, reservoirs) — existing
5. Road paths — existing
6. Street labels — existing
7. `<clipPath id="frame">` in `<defs>` — the drawn polygon projected to SVG coords

## Data Source

Bundle `ne_10m_land.json` (Natural Earth 1:10m land polygons, ~3–4 MB) at `backend/src/data/ne_10m_land.json`. Loaded once into module scope at startup — no per-request file I/O.

**Why Natural Earth 1:10m:**
- Global coverage — works for any drawn area worldwide
- Major lakes (Lake Michigan, Great Lakes, Caspian Sea, etc.) are already absent from the land features (they are holes), so they appear as water with no special handling
- Self-contained — no external service or large download required at runtime
- Upgrade path: replace with OSM land polygons dataset when hosting is established for higher coastline fidelity

**Limitation:** ~50m resolution. Fine shoreline detail (small bays, inlets) is smoothed. Acceptable for city-scale artwork; a known trade-off against the zero-infrastructure requirement.

## Architecture

### New type

```typescript
// backend/src/types.ts
export type LandRing = [number, number][]; // [lng, lat] pairs, closed ring
```

### New module: `backend/src/data/landData.ts`

Loads `ne_10m_land.json` at module init. Exports one function:

```typescript
export function fetchLandGeometry(polygon: GeoJSONPolygon): LandRing[]
```

- Bounding-box pre-filter (fast rejection of distant features)
- Polygon intersection of remaining candidates against the drawn polygon
- Returns clipped outer rings as `LandRing[]`
- Synchronous — no network call

Intersection uses `@turf/intersect` (already available via `@turf/turf` if present, otherwise added as a minimal dependency).

### `geometryService.ts`

No changes to existing functions. `fetchLandGeometry` lives in its own `landData.ts` module to keep geometry concerns separated from Overpass concerns.

### `artwork.ts` route

```typescript
const [streetData, waterRings, landRings] = await Promise.all([
  fetchStreetGeometry(polygon),
  fetchWaterGeometry(polygon),
  Promise.resolve(fetchLandGeometry(polygon)), // synchronous, wrapped for uniformity
]);
```

Pass `polygon` and `landRings` to `generateSvg`.

### `artEngine.ts`

**Bounding box from drawn polygon (not streets)**

Replace the `getBoundingBox(features)` call in `generateSvg` with `getBoundingBoxFromPolygon(polygon)`. This anchors the SVG coordinate space to the user's drawn shape, not to the extent of streets Overpass returned (which can extend outside the boundary).

```typescript
function getBoundingBoxFromPolygon(polygon: GeoJSONPolygon): BoundingBox
```

**New `renderLandBodies` function**

```typescript
function renderLandBodies(landRings: LandRing[], bbox: BoundingBox, preset: StylePreset): string
```

Renders each ring as a closed `<path class="land-body">` filled with the preset background color (land is the "default" surface — same color as the canvas background). Rendered immediately after the water background rect, before Overpass water bodies.

**New `renderClipPath` function**

```typescript
function renderClipPath(polygon: GeoJSONPolygon, bbox: BoundingBox, preset: StylePreset): string
```

Projects the drawn polygon through `toSvgCoords` and emits:

```svg
<defs>
  <clipPath id="frame">
    <path d="M x,y L x,y ... Z"/>
  </clipPath>
</defs>
```

**Updated `generateSvg` signature**

```typescript
export function generateSvg(
  streetData: GeoJSONFeatureCollection,
  style: StyleName,
  labelOffset: number,
  groupMap: Record<string, string>,
  waterRings: WaterRing[],
  landRings: LandRing[],
  drawnPolygon: GeoJSONPolygon,
): string
```

Output structure:

```svg
<svg ...>
  <defs>
    <clipPath id="frame"><path d="..."/></clipPath>
    <!-- street label paths -->
  </defs>
  <rect class="canvas-bg" ... fill="backgroundColor"/>  <!-- full canvas, visible outside polygon -->
  <g clip-path="url(#frame)">
    <rect class="water-bg" ... fill="waterColor"/>       <!-- fills polygon area with water -->
    <!-- land bodies (fill=backgroundColor) -->
    <!-- water bodies (fill=waterColor) -->
    <!-- roads -->
    <!-- labels -->
  </g>
</svg>
```

**Two rects, two purposes:**
- `rect.canvas-bg` — the full 2400×2400 background, always `backgroundColor`. Visible outside the drawn polygon (the "paper" or "mount" area on a printed product). Never water-colored.
- `rect.water-bg` — inside the clip group, fills the polygon area with water color before land is painted. This is what makes oceans and large lakes appear correctly.

The CSS injection in `App.tsx` (`applyStreetStyle`) must be updated to target both: `rect.water-bg{fill:${waterColor};}path.water-body{fill:${waterColor};}` so the water color picker controls all water surfaces.

## What Does Not Change

- `fetchWaterGeometry` — unchanged; Overpass water query still handles rivers, ponds, reservoirs
- Frontend payload — `polygon` is already sent on every generate request
- Water color picker — the CSS injection in `applyStreetStyle` must be updated to target `rect.water-bg` (the inner polygon-area water fill) and `path.water-body` (Overpass rivers/ponds). `rect.canvas-bg` is never water-colored.
- `WaterRing` type — unchanged

## Testing

| Test | Where |
|------|-------|
| `fetchLandGeometry` returns rings for a polygon over land | `backend/tests/unit/landData.test.ts` |
| `fetchLandGeometry` returns empty for a polygon in the ocean | `backend/tests/unit/landData.test.ts` |
| `fetchLandGeometry` returns a clipped ring for a polygon straddling a coastline | `backend/tests/unit/landData.test.ts` |
| `generateSvg` renders land paths before water paths before road paths | `backend/tests/unit/artEngine.test.ts` |
| `generateSvg` includes `<clipPath id="frame">` | `backend/tests/unit/artEngine.test.ts` |
| `generateSvg` derives bbox from polygon, not features | `backend/tests/unit/artEngine.test.ts` |

## Upgrade Path to OSM Land Polygons

When hosting is available, replace `backend/src/data/ne_10m_land.json` and the bounding-box pre-filter in `landData.ts` with a spatial query against the OSM land polygons tile service or a PostGIS table. The `fetchLandGeometry` interface stays identical — no changes to `artEngine.ts`, `artwork.ts`, or the frontend.
