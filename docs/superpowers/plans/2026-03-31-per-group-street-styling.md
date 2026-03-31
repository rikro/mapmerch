# Per-Group Street Styling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global stroke-weight/dash-style controls with full per-road-type styling (weight, dash, color) behind an inline accordion UI, while stamping each SVG path with its road group CSS class on the backend.

**Architecture:** The backend gains a `groupMap` parameter that maps OSM highway types to group IDs and stamps each `<path>` with `class="road-{groupId}"`. The frontend replaces the single `path[fill="none"]` CSS rule with per-group rules derived from the new `groupStyles` field on `StreetConfig`. The StudioPanel "Street Types" section is rebuilt as a checkbox-left / chevron-right accordion, with weight, dash, and color controls inline.

**Tech Stack:** TypeScript, React, Express, SVG CSS injection, Jest (backend unit tests), no new dependencies.

---

## File Map

| File | Change |
|------|--------|
| `frontend/src/types.ts` | Add `StreetGroupStyle`, update `StreetConfig` |
| `frontend/src/constants.ts` | Update `DEFAULT_STREET_CONFIG` with per-group defaults |
| `backend/src/types.ts` | Add `groupMap` to `GenerateArtworkRequest` |
| `backend/src/services/artEngine.ts` | Add `groupMap` param, stamp paths with `class="road-{groupId}"` |
| `backend/tests/unit/artEngine.test.ts` | Fix stale tests, add groupMap coverage |
| `backend/src/routes/artwork.ts` | Pass `groupMap` to `generateSvg` |
| `frontend/src/api/client.ts` | Add `groupMap` to `generateArtwork` |
| `frontend/src/hooks/useArtwork.ts` | Add `groupMap` to `generate` signature |
| `frontend/src/App.tsx` | Replace `resolvedHighwayTypes`, rewrite `applyStreetStyle`, update call sites |
| `frontend/src/components/StudioPanel.tsx` | Rebuild Streets tab with accordion UI |

---

## Task 1: Update Types

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `backend/src/types.ts`

- [ ] **Step 1: Update `frontend/src/types.ts`**

Replace the `StreetConfig` interface and add `StreetGroupStyle`. The file currently has:

```typescript
export interface StreetConfig {
  strokeWidth: number;
  dashStyle: DashStyle;
  enabledGroups: StreetGroupId[];
}
```

Replace it with:

```typescript
export interface StreetGroupStyle {
  strokeWidth: number;
  dashStyle: DashStyle;
  color: string | null; // null = follow theme (no CSS color override)
}

export interface StreetConfig {
  enabledGroups: StreetGroupId[];
  groupStyles: Record<StreetGroupId, StreetGroupStyle>;
}
```

- [ ] **Step 2: Update `backend/src/types.ts`**

Add `groupMap` to `GenerateArtworkRequest`. Find this interface:

```typescript
export interface GenerateArtworkRequest {
  polygon: GeoJSONPolygon;
  style: StyleName;
  sessionToken: string;
  highwayTypes?: string[];
  labelOffset?: number;
}
```

Replace it with:

```typescript
export interface GenerateArtworkRequest {
  polygon: GeoJSONPolygon;
  style: StyleName;
  sessionToken: string;
  highwayTypes?: string[];
  labelOffset?: number;
  groupMap?: Record<string, string>; // OSM highway type → group ID, e.g. { motorway: 'major' }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npm run build 2>&1 | head -30
cd ../frontend && npm run build 2>&1 | head -30
```

Expected: TypeScript errors on `StreetConfig` usages (strokeWidth/dashStyle removed) — that's correct, they'll be fixed in later tasks. Zero errors in backend at this point.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts backend/src/types.ts
git commit -m "feat: add StreetGroupStyle type and groupMap to GenerateArtworkRequest"
```

---

## Task 2: Update Constants

**Files:**
- Modify: `frontend/src/constants.ts`

- [ ] **Step 1: Update `DEFAULT_STREET_CONFIG`**

The current file ends with:

```typescript
export const DEFAULT_STREET_CONFIG: StreetConfig = {
  strokeWidth: 3,
  dashStyle: 'solid',
  enabledGroups: STREET_GROUPS.filter(g => g.defaultOn).map(g => g.id),
};
```

Replace it with:

```typescript
export const DEFAULT_STREET_CONFIG: StreetConfig = {
  enabledGroups: STREET_GROUPS.filter(g => g.defaultOn).map(g => g.id),
  groupStyles: {
    major:      { strokeWidth: 4,   dashStyle: 'solid',  color: null },
    secondary:  { strokeWidth: 2.5, dashStyle: 'solid',  color: null },
    local:      { strokeWidth: 1.5, dashStyle: 'solid',  color: null },
    pedestrian: { strokeWidth: 1,   dashStyle: 'dotted', color: null },
    cycling:    { strokeWidth: 1,   dashStyle: 'dashed', color: null },
    service:    { strokeWidth: 1,   dashStyle: 'solid',  color: null },
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/constants.ts
git commit -m "feat: add per-group style defaults to DEFAULT_STREET_CONFIG"
```

---

## Task 3: Backend — Stamp Paths with Road Group Class

**Files:**
- Modify: `backend/src/services/artEngine.ts`
- Modify: `backend/tests/unit/artEngine.test.ts`

- [ ] **Step 1: Write failing tests**

The existing tests have two stale assertions (`<polyline` and `width="2400"`) that already fail against the current code. Fix those and add two new tests for the groupMap feature.

Replace the full contents of `backend/tests/unit/artEngine.test.ts` with:

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
    expect(svg).toContain('<path');
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

  it('outputs SVG with correct viewBox for 2400px canvas', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art');
    expect(svg).toContain('viewBox="0 0 2400 2400"');
  });

  it('stamps paths with road group class when groupMap provided', () => {
    const data: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-87.6298, 41.8781], [-87.6248, 41.8831]] },
        properties: { highway: 'motorway' },
      }],
    };
    const svg = generateSvg(data, 'minimal-line-art', 24, { motorway: 'major' });
    expect(svg).toContain('class="road-major"');
  });

  it('falls back to road-local class when highway type not in groupMap', () => {
    const data: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-87.6298, 41.8781], [-87.6248, 41.8831]] },
        properties: { highway: 'unknown_type' },
      }],
    };
    const svg = generateSvg(data, 'minimal-line-art', 24, { motorway: 'major' });
    expect(svg).toContain('class="road-local"');
  });

  it('uses road-local class when feature has no highway property', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, { motorway: 'major' });
    expect(svg).toContain('class="road-local"');
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
cd backend && npm test 2>&1 | tail -20
```

Expected: the two new `groupMap` tests fail with "does not contain `class=\"road-major\"`", and the stale `<polyline` / `width="2400"` tests fail.

- [ ] **Step 3: Update `artEngine.ts`**

Change `renderPaths` to accept `groupMap` and stamp each path with its group class. Change `generateSvg` to accept and pass `groupMap`.

In `backend/src/services/artEngine.ts`, find and replace the `renderPaths` function:

```typescript
// BEFORE:
function renderPaths(
  features: GeoJSONFeatureCollection['features'],
  bbox: BoundingBox,
  preset: StylePreset,
): string {
  return features
    .map(feature => {
      const pts = feature.geometry.coordinates.map(
        ([lng, lat]) => toSvgCoords(lng, lat, bbox, preset.padding),
      );
      const d = smoothedPathD(pts);
      return `  <path d="${d}" fill="none" stroke="${preset.strokeColor}" stroke-width="${preset.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('\n');
}
```

Replace with:

```typescript
function renderPaths(
  features: GeoJSONFeatureCollection['features'],
  bbox: BoundingBox,
  preset: StylePreset,
  groupMap: Record<string, string>,
): string {
  return features
    .map(feature => {
      const pts = feature.geometry.coordinates.map(
        ([lng, lat]) => toSvgCoords(lng, lat, bbox, preset.padding),
      );
      const d = smoothedPathD(pts);
      const highway = feature.properties['highway'] as string | undefined;
      const groupId = highway ? (groupMap[highway] ?? 'local') : 'local';
      return `  <path class="road-${groupId}" d="${d}" fill="none" stroke="${preset.strokeColor}" stroke-width="${preset.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('\n');
}
```

Then find and replace `generateSvg`:

```typescript
// BEFORE:
export function generateSvg(
  streetData: GeoJSONFeatureCollection,
  style: StyleName,
  labelOffset = LABEL_DEFAULT_OFFSET_PX,
): string {
  if (streetData.features.length === 0) {
    throw new Error('No street data to render');
  }
  const preset = getStylePreset(style);
  const bbox = getBoundingBox(streetData.features);
  const paths = renderPaths(streetData.features, bbox, preset);
  const labels = renderStreetLabels(streetData.features, bbox, preset, labelOffset);
  // ...
}
```

Replace with:

```typescript
export function generateSvg(
  streetData: GeoJSONFeatureCollection,
  style: StyleName,
  labelOffset = LABEL_DEFAULT_OFFSET_PX,
  groupMap: Record<string, string> = {},
): string {
  if (streetData.features.length === 0) {
    throw new Error('No street data to render');
  }
  const preset = getStylePreset(style);
  const bbox = getBoundingBox(streetData.features);
  const paths = renderPaths(streetData.features, bbox, preset, groupMap);
  const labels = renderStreetLabels(streetData.features, bbox, preset, labelOffset);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${preset.backgroundColor}"/>
${paths}
${labels}
</svg>`;
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
cd backend && npm test 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/artEngine.ts backend/tests/unit/artEngine.test.ts
git commit -m "feat: stamp SVG paths with road group CSS class via groupMap"
```

---

## Task 4: Backend Route — Pass `groupMap` to `generateSvg`

**Files:**
- Modify: `backend/src/routes/artwork.ts`

- [ ] **Step 1: Update the route**

Find and replace the route handler body in `backend/src/routes/artwork.ts`:

```typescript
// BEFORE:
const { highwayTypes, labelOffset } = req.body as GenerateArtworkRequest;
const streetData = await fetchStreetGeometry(polygon);
const filtered = highwayTypes?.length
  ? { ...streetData, features: streetData.features.filter(f => highwayTypes.includes(f.properties['highway'] as string)) }
  : streetData;
if (filtered.features.length === 0) {
  return res.status(400).json({ error: 'No streets of the selected types found in this area. Try enabling more street types.' });
}
const svg = generateSvg(filtered, style, labelOffset);
```

Replace with:

```typescript
const { highwayTypes, labelOffset, groupMap } = req.body as GenerateArtworkRequest;
const streetData = await fetchStreetGeometry(polygon);
const filtered = highwayTypes?.length
  ? { ...streetData, features: streetData.features.filter(f => highwayTypes.includes(f.properties['highway'] as string)) }
  : streetData;
if (filtered.features.length === 0) {
  return res.status(400).json({ error: 'No streets of the selected types found in this area. Try enabling more street types.' });
}
const svg = generateSvg(filtered, style, labelOffset, groupMap ?? {});
```

- [ ] **Step 2: Verify backend builds clean**

```bash
cd backend && npm run build 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/artwork.ts
git commit -m "feat: pass groupMap from request body to generateSvg"
```

---

## Task 5: Frontend API Client and `useArtwork` Hook

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/hooks/useArtwork.ts`

- [ ] **Step 1: Update `generateArtwork` in `client.ts`**

Find and replace the `generateArtwork` function:

```typescript
// BEFORE:
export async function generateArtwork(
  polygon: PolygonCoords,
  style: StyleName,
  sessionToken: string,
  highwayTypes: string[],
  labelOffset: number,
): Promise<GenerateArtworkResponse> {
  const res = await fetch(`${BASE_URL}/api/artwork/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon, style, sessionToken, highwayTypes, labelOffset }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Artwork generation failed');
  }
  return res.json() as Promise<GenerateArtworkResponse>;
}
```

Replace with:

```typescript
export async function generateArtwork(
  polygon: PolygonCoords,
  style: StyleName,
  sessionToken: string,
  highwayTypes: string[],
  labelOffset: number,
  groupMap: Record<string, string>,
): Promise<GenerateArtworkResponse> {
  const res = await fetch(`${BASE_URL}/api/artwork/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon, style, sessionToken, highwayTypes, labelOffset, groupMap }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Artwork generation failed');
  }
  return res.json() as Promise<GenerateArtworkResponse>;
}
```

- [ ] **Step 2: Update `useArtwork.ts`**

Find and replace the `generate` callback:

```typescript
// BEFORE:
const generate = useCallback(
  async (polygon: PolygonCoords, style: StyleName, highwayTypes: string[], labelOffset: number) => {
    if (lastPolygonRef.current !== polygon) {
      cache.current.clear();
      lastPolygonRef.current = polygon;
    }

    const cacheKey = `${style}:${[...highwayTypes].sort().join(',')}:${labelOffset}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setState({ draftId: cached.draftId, svg: cached.svg, loading: false, error: null });
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await generateArtwork(polygon, style, sessionToken, highwayTypes, labelOffset);
      cache.current.set(cacheKey, { draftId: result.draftId, svg: result.svg });
      setState({ draftId: result.draftId, svg: result.svg, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Artwork generation failed. Please try again.';
      setState(s => ({ ...s, loading: false, error: message }));
    }
  },
  [sessionToken],
);
```

Replace with:

```typescript
const generate = useCallback(
  async (polygon: PolygonCoords, style: StyleName, highwayTypes: string[], labelOffset: number, groupMap: Record<string, string>) => {
    if (lastPolygonRef.current !== polygon) {
      cache.current.clear();
      lastPolygonRef.current = polygon;
    }

    const cacheKey = `${style}:${[...highwayTypes].sort().join(',')}:${labelOffset}`;
    const cached = cache.current.get(cacheKey);
    if (cached) {
      setState({ draftId: cached.draftId, svg: cached.svg, loading: false, error: null });
      return;
    }

    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await generateArtwork(polygon, style, sessionToken, highwayTypes, labelOffset, groupMap);
      cache.current.set(cacheKey, { draftId: result.draftId, svg: result.svg });
      setState({ draftId: result.draftId, svg: result.svg, loading: false, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Artwork generation failed. Please try again.';
      setState(s => ({ ...s, loading: false, error: message }));
    }
  },
  [sessionToken],
);
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/hooks/useArtwork.ts
git commit -m "feat: add groupMap to generateArtwork and useArtwork.generate"
```

---

## Task 6: App.tsx — `resolvedStreetArgs` and `applyStreetStyle`

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace `resolvedHighwayTypes` with `resolvedStreetArgs`**

Find this function:

```typescript
function resolvedHighwayTypes(config: StreetConfig): string[] {
  return STREET_GROUPS
    .filter(g => config.enabledGroups.includes(g.id))
    .flatMap(g => g.types);
}
```

Replace it with:

```typescript
function resolvedStreetArgs(config: StreetConfig): { highwayTypes: string[]; groupMap: Record<string, string> } {
  const enabled = STREET_GROUPS.filter(g => config.enabledGroups.includes(g.id));
  const highwayTypes = enabled.flatMap(g => g.types);
  const groupMap: Record<string, string> = {};
  enabled.forEach(g => g.types.forEach(t => { groupMap[t] = g.id; }));
  return { highwayTypes, groupMap };
}
```

- [ ] **Step 2: Rewrite `applyStreetStyle`**

Find this function (including the `DASH_ARRAYS` constant above it):

```typescript
const DASH_ARRAYS: Record<DashStyle, string | null> = {
  solid: null,
  dashed: '20,14',
  dotted: '3,10',
};

function applyStreetStyle(
  rawSvg: string | null,
  config: StreetConfig,
  labelTypography: TypographyConfig,
): string | null {
  if (!rawSvg) return null;
  const dash = DASH_ARRAYS[config.dashStyle];
  const dashRule = dash ? `stroke-dasharray:${dash};` : '';
  const textRules = [
    `font-family:${labelTypography.typeface},sans-serif`,
    `font-size:${labelTypography.size}px`,
    `font-weight:${labelTypography.weight}`,
    labelTypography.color ? `fill:${labelTypography.color}` : '',
  ].filter(Boolean).join(';');
  const style = `<style>path[fill="none"]{stroke-width:${config.strokeWidth};${dashRule}}text{${textRules};}</style>`;
  return rawSvg.replace(/(<svg[^>]*>)/, `$1${style}`);
}
```

Replace it with:

```typescript
const DASH_ARRAYS: Record<DashStyle, string | null> = {
  solid: null,
  dashed: '20,14',
  dotted: '3,10',
};

function applyStreetStyle(
  rawSvg: string | null,
  config: StreetConfig,
  labelTypography: TypographyConfig,
): string | null {
  if (!rawSvg) return null;

  const groupRules = STREET_GROUPS
    .filter(g => config.enabledGroups.includes(g.id))
    .map(g => {
      const s = config.groupStyles[g.id];
      const dash = DASH_ARRAYS[s.dashStyle];
      const dashRule = dash ? `stroke-dasharray:${dash};` : '';
      const colorRule = s.color ? `stroke:${s.color};` : '';
      return `path.road-${g.id}{stroke-width:${s.strokeWidth};${dashRule}${colorRule}}`;
    })
    .join('');

  const textRules = [
    `font-family:${labelTypography.typeface},sans-serif`,
    `font-size:${labelTypography.size}px`,
    `font-weight:${labelTypography.weight}`,
    labelTypography.color ? `fill:${labelTypography.color}` : '',
  ].filter(Boolean).join(';');

  const style = `<style>${groupRules}text{${textRules};}</style>`;
  return rawSvg.replace(/(<svg[^>]*>)/, `$1${style}`);
}
```

- [ ] **Step 3: Update `handlePolygonComplete`**

Find:

```typescript
const handlePolygonComplete = useCallback(
  (p: PolygonCoords) => {
    setPolygon(p);
    setAreaError(null);
    generate(p, style, resolvedHighwayTypes(streetConfig), labelTypography.baselineOffset ?? 24);
    setStep('customize');
  },
  [generate, style, streetConfig, labelTypography.baselineOffset],
);
```

Replace with:

```typescript
const handlePolygonComplete = useCallback(
  (p: PolygonCoords) => {
    setPolygon(p);
    setAreaError(null);
    const { highwayTypes, groupMap } = resolvedStreetArgs(streetConfig);
    generate(p, style, highwayTypes, labelTypography.baselineOffset ?? 24, groupMap);
    setStep('customize');
  },
  [generate, style, streetConfig, labelTypography.baselineOffset],
);
```

- [ ] **Step 4: Update `handleStyleChange`**

Find:

```typescript
const handleStyleChange = useCallback(
  (newStyle: StyleName) => {
    setStyle(newStyle);
    if (polygon) generate(polygon, newStyle, resolvedHighwayTypes(streetConfig), labelTypography.baselineOffset ?? 24);
  },
  [generate, polygon, streetConfig, labelTypography.baselineOffset],
);
```

Replace with:

```typescript
const handleStyleChange = useCallback(
  (newStyle: StyleName) => {
    setStyle(newStyle);
    if (polygon) {
      const { highwayTypes, groupMap } = resolvedStreetArgs(streetConfig);
      generate(polygon, newStyle, highwayTypes, labelTypography.baselineOffset ?? 24, groupMap);
    }
  },
  [generate, polygon, streetConfig, labelTypography.baselineOffset],
);
```

- [ ] **Step 5: Update `handleStreetConfigChange`**

Find:

```typescript
const handleStreetConfigChange = useCallback(
  (patch: Partial<StreetConfig>) => {
    const next = { ...streetConfig, ...patch };
    setStreetConfig(next);
    if ('enabledGroups' in patch && polygon) {
      generate(polygon, style, resolvedHighwayTypes(next), labelTypography.baselineOffset ?? 24);
    }
  },
  [streetConfig, polygon, style, generate, labelTypography.baselineOffset],
);
```

Replace with:

```typescript
const handleStreetConfigChange = useCallback(
  (patch: Partial<StreetConfig>) => {
    const next = { ...streetConfig, ...patch };
    setStreetConfig(next);
    if ('enabledGroups' in patch && polygon) {
      const { highwayTypes, groupMap } = resolvedStreetArgs(next);
      generate(polygon, style, highwayTypes, labelTypography.baselineOffset ?? 24, groupMap);
    }
  },
  [streetConfig, polygon, style, generate, labelTypography.baselineOffset],
);
```

- [ ] **Step 6: Update `handleLabelTypographyChange`**

Find inside the timeout callback:

```typescript
generate(polygon, style, resolvedHighwayTypes(streetConfig), next.baselineOffset ?? 24);
```

Replace with:

```typescript
const { highwayTypes, groupMap } = resolvedStreetArgs(streetConfig);
generate(polygon, style, highwayTypes, next.baselineOffset ?? 24, groupMap);
```

- [ ] **Step 7: Verify frontend builds**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: zero TypeScript errors (StudioPanel will have errors until Task 7).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: replace resolvedHighwayTypes with resolvedStreetArgs, rewrite applyStreetStyle for per-group CSS"
```

---

## Task 7: StudioPanel — Inline Accordion UI

**Files:**
- Modify: `frontend/src/components/StudioPanel.tsx`

- [ ] **Step 1: Add `StreetGroupStyle` to imports**

Find the import block at the top of `StudioPanel.tsx`:

```typescript
import {
  StyleName, StyleOption,
  TypographyConfig, CoordsConfig, CoordFormat, CoordPosition,
  SymbolConfig, SymbolIcon,
  StreetConfig, StreetGroupId, DashStyle,
} from '../types.js';
```

Replace with:

```typescript
import {
  StyleName, StyleOption,
  TypographyConfig, CoordsConfig, CoordFormat, CoordPosition,
  SymbolConfig, SymbolIcon,
  StreetConfig, StreetGroupId, StreetGroupStyle, DashStyle,
} from '../types.js';
```

- [ ] **Step 2: Add `expandedGroups` state to `StudioPanel`**

Find:

```typescript
export default function StudioPanel({ ... }: Props) {
  const [activeTextElement, setActiveTextElement] = React.useState<'title' | 'labels'>('title');
  return (
```

Replace with:

```typescript
export default function StudioPanel({ ... }: Props) {
  const [activeTextElement, setActiveTextElement] = React.useState<'title' | 'labels'>('title');
  const [expandedGroups, setExpandedGroups] = React.useState<Set<StreetGroupId>>(new Set());
  return (
```

- [ ] **Step 3: Add `GroupLinePreview` component**

Add this function immediately before the `export default function StudioPanel` line:

```typescript
function GroupLinePreview({ groupStyle }: { groupStyle: StreetGroupStyle }) {
  const dashArray =
    groupStyle.dashStyle === 'dashed' ? '5,3' :
    groupStyle.dashStyle === 'dotted' ? '2,3' :
    undefined;
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" className="flex-shrink-0">
      <line
        x1="1" y1="5" x2="21" y2="5"
        stroke={groupStyle.color ?? 'currentColor'}
        strokeWidth={Math.min(groupStyle.strokeWidth, 5)}
        strokeLinecap="round"
        strokeDasharray={dashArray}
      />
    </svg>
  );
}
```

- [ ] **Step 4: Replace the Streets tab content**

Find the entire `{activeTab === 'streets' && ( ... )}` block (lines ~152–221 in the original file). It currently renders: Color Theme, Line Weight slider, Line Style buttons, Street Types toggle rows. Replace the entire block with:

```typescript
{/* ── STREETS ── */}
{activeTab === 'streets' && (
  <div className="space-y-6">
    <SectionHeader icon={Route} title="Streets" subtitle="Control which streets appear and how they're drawn" />

    <div className="space-y-3">
      <Label>Color Theme</Label>
      <StyleSelector options={styleOptions} selected={selectedStyle} onChange={onStyleChange} />
    </div>

    <div className="space-y-3">
      <Label>Street Types</Label>
      <div className="space-y-0.5">
        {STREET_GROUPS.map(({ id, label }) => {
          const groupId = id as StreetGroupId;
          const isEnabled = streetConfig.enabledGroups.includes(groupId);
          const isExpanded = expandedGroups.has(groupId);
          const groupStyle = streetConfig.groupStyles[groupId];

          const toggleEnabled = () => {
            const groups = isEnabled
              ? streetConfig.enabledGroups.filter(g => g !== groupId)
              : [...streetConfig.enabledGroups, groupId];
            onStreetConfigChange({ enabledGroups: groups });
          };

          const toggleExpanded = () => {
            setExpandedGroups(prev => {
              const next = new Set(prev);
              next.has(groupId) ? next.delete(groupId) : next.add(groupId);
              return next;
            });
          };

          const patchGroupStyle = (patch: Partial<StreetGroupStyle>) => {
            onStreetConfigChange({
              groupStyles: {
                ...streetConfig.groupStyles,
                [groupId]: { ...groupStyle, ...patch },
              },
            });
          };

          return (
            <div key={id}>
              {/* Row */}
              <div className={cn(
                'flex items-center gap-2 py-2 px-1.5 rounded-lg',
                isExpanded ? 'bg-primary/5 rounded-b-none' : 'hover:bg-slate-50',
              )}>
                {/* Checkbox */}
                <button
                  onClick={toggleEnabled}
                  className={cn(
                    'w-[17px] h-[17px] rounded-[5px] border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    isEnabled ? 'bg-primary border-primary' : 'bg-white border-slate-300',
                  )}
                >
                  {isEnabled && (
                    <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="white" strokeWidth="2.8">
                      <polyline points="2,6 5,9 10,3"/>
                    </svg>
                  )}
                </button>

                {/* Label */}
                <span
                  onClick={toggleExpanded}
                  className={cn(
                    'text-sm font-medium flex-1 cursor-pointer',
                    isEnabled ? 'text-slate-700' : 'text-slate-400',
                  )}
                >
                  {label}
                </span>

                {/* Mini line preview */}
                <button
                  onClick={toggleExpanded}
                  className={cn('flex-shrink-0', !isEnabled && 'opacity-30')}
                >
                  <GroupLinePreview groupStyle={groupStyle} />
                </button>

                {/* Chevron */}
                <button
                  onClick={toggleExpanded}
                  className={cn(
                    'text-[9px] flex-shrink-0 transition-colors w-4 text-center',
                    isExpanded ? 'text-primary' : 'text-slate-400',
                  )}
                >
                  {isExpanded ? '▲' : '▼'}
                </button>
              </div>

              {/* Inline controls */}
              {isExpanded && (
                <div className="bg-primary/5 rounded-b-lg px-3 pb-3 pt-2 space-y-3 border-t border-primary/10">
                  {/* Weight */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label>Weight</Label>
                      <span className="text-xs font-bold text-primary">{groupStyle.strokeWidth}px</span>
                    </div>
                    <input
                      type="range" min="0.5" max="12" step="0.5"
                      className="w-full h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer accent-primary"
                      value={groupStyle.strokeWidth}
                      onChange={(e) => patchGroupStyle({ strokeWidth: parseFloat(e.target.value) })}
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                      <span>Hairline</span>
                      <span>Bold</span>
                    </div>
                  </div>

                  {/* Dash style */}
                  <div className="space-y-1.5">
                    <Label>Style</Label>
                    <div className="flex gap-1.5">
                      {DASH_OPTIONS.map(({ id: dashId, label: dashLabel }) => (
                        <button
                          key={dashId}
                          onClick={() => patchGroupStyle({ dashStyle: dashId })}
                          className={cn(
                            'flex-1 py-1.5 text-xs font-bold rounded-lg border-2 transition-all',
                            groupStyle.dashStyle === dashId
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-transparent bg-white text-slate-600 hover:bg-slate-50',
                          )}
                        >
                          {dashLabel}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color */}
                  <div className="space-y-1.5">
                    <Label>
                      Color
                      {!groupStyle.color && (
                        <span className="ml-1 normal-case font-normal text-slate-400">(follows theme)</span>
                      )}
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => patchGroupStyle({ color: null })}
                        title="Follow color theme"
                        className={cn(
                          'w-6 h-6 rounded-[5px] border-2 transition-all flex items-center justify-center text-[8px] font-bold',
                          !groupStyle.color
                            ? 'border-primary text-primary bg-primary/10 scale-110'
                            : 'border-dashed border-slate-300 text-slate-400 hover:scale-105',
                        )}
                      >
                        Auto
                      </button>
                      {COLOR_SWATCHES.map((c) => (
                        <button
                          key={c}
                          onClick={() => patchGroupStyle({ color: c })}
                          className={cn(
                            'w-6 h-6 rounded-[5px] border-2 transition-all',
                            groupStyle.color === c ? 'border-primary scale-110' : 'border-slate-200 hover:scale-105',
                          )}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed">
        Toggling a street type regenerates the artwork. Style changes apply instantly.
      </p>
    </div>
  </div>
)}
```

- [ ] **Step 5: Remove the `Toggle` component**

The `Toggle` function (lines ~86–101 in the original) is no longer used. Find and delete it:

```typescript
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-10 h-5 rounded-full relative transition-colors flex-shrink-0',
        on ? 'bg-primary' : 'bg-slate-200',
      )}
    >
      <div className={cn(
        'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all',
        on ? 'right-0.5' : 'left-0.5',
      )} />
    </button>
  );
}
```

- [ ] **Step 6: Verify frontend builds clean**

```bash
cd frontend && npm run build 2>&1 | head -30
```

Expected: zero TypeScript errors, successful build.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/StudioPanel.tsx
git commit -m "feat: replace global street controls with per-group inline accordion"
```

---

## Task 8: Manual Smoke Test

- [ ] **Step 1: Start dev servers**

Terminal 1 (backend):
```bash
cd backend && npm run dev
```

Terminal 2 (frontend):
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Run the happy path**

1. Open `http://localhost:5173`
2. Click Start → draw a polygon over a city area
3. In the Streets tab, verify:
   - Six rows each have a checkbox on the left and a chevron on the right
   - No global line weight slider or dash style buttons
   - Mini line preview visible on each collapsed row
4. Expand "Major Roads" → verify weight slider, dash pill buttons, and color swatches appear inline
5. Change major roads stroke weight to 8px → artwork updates instantly (no spinner)
6. Change major roads color to gold (`#f5c518`) → artwork updates instantly with gold major roads
7. Change major roads dash to "Dashed" → artwork updates instantly
8. Uncheck "Secondary" → artwork regenerates (spinner appears), secondary roads disappear
9. Re-check "Secondary" → artwork regenerates with secondary roads back
10. Expand a second group simultaneously → both accordions open at once
11. Verify "Color (follows theme)" label appears when Auto is selected

- [ ] **Step 3: Verify SVG class stamps**

In browser DevTools, inspect the generated SVG in the artwork preview:
- Open Elements tab, find the `<svg>` inside the artwork canvas
- Confirm paths have `class="road-major"`, `class="road-local"`, etc.
- Confirm the injected `<style>` block contains rules like `path.road-major{stroke-width:4;}`

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -p
git commit -m "fix: address smoke test issues"
```
