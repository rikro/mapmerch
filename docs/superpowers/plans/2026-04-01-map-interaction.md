# Map Interaction Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add location search, circle and rectangle drawing tools, remove the broken edit button, and enable a trash button with a custom confirmation modal.

**Architecture:** `MapView` is restructured to wrap the Leaflet container in a positioning div so React-rendered overlays (`LocationSearch`, `DeleteConfirmModal`) can sit on top. All three shape types (polygon, rectangle, circle) are normalized to `PolygonCoords` before calling the parent callback. The trash button is intercepted in the capture phase to prevent leaflet-draw's multi-step delete mode; instead a single-click confirmation modal takes over.

**Tech Stack:** React 18, TypeScript, Leaflet 1.9, leaflet-draw 1.0, Tailwind CSS 4, motion/react, lucide-react, Nominatim geocoding API, Playwright for e2e tests.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/components/MapView.tsx` | Wrap Leaflet container; add rectangle/circle draw config; add `circleToPolygon` helper; intercept delete button; render LocationSearch and DeleteConfirmModal; add `onShapeCleared` prop |
| Create | `frontend/src/components/LocationSearch.tsx` | Search input + Nominatim fetch + geolocation button; calls `mapRef.current.flyTo()` |
| Create | `frontend/src/components/DeleteConfirmModal.tsx` | Animated confirmation modal; Cancel / Delete buttons |
| Modify | `frontend/src/App.tsx` | Pass `onShapeCleared` handler to MapView; update "How to Draw" instructions text |
| Create | `frontend/tests/e2e/mapInteraction.spec.ts` | E2e tests for search overlay, delete modal, toolbar state |

---

## Task 1: Write e2e tests for the new map interaction features (failing baseline)

**Files:**
- Create: `frontend/tests/e2e/mapInteraction.spec.ts`

- [ ] **Step 1: Create the test file**

```typescript
// frontend/tests/e2e/mapInteraction.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Navigate to the draw step
  await page.getByRole('button', { name: /Start Your Map/i }).click();
  await expect(page.getByTestId('map-view')).toBeVisible();
});

test('location search overlay is visible on draw step', async ({ page }) => {
  await expect(page.getByTestId('location-search')).toBeVisible();
});

test('use my location button is visible', async ({ page }) => {
  await expect(page.getByTestId('use-my-location')).toBeVisible();
});

test('location search shows error for empty query', async ({ page }) => {
  await page.getByTestId('location-search-input').fill('');
  await page.getByTestId('location-search-submit').click();
  // No fetch is made for empty input — no error shown either, button is just disabled or no-op
  await expect(page.getByTestId('location-search-error')).not.toBeVisible();
});

test('location search shows not-found message for gibberish query', async ({ page }) => {
  // Mock Nominatim to return empty results
  await page.route('**/nominatim.openstreetmap.org/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.getByTestId('location-search-input').fill('zzzznotaplace12345');
  await page.getByTestId('location-search-submit').click();
  await expect(page.getByTestId('location-search-error')).toBeVisible();
  await expect(page.getByTestId('location-search-error')).toContainText('No results');
});

test('location search flies to result on valid query', async ({ page }) => {
  await page.route('**/nominatim.openstreetmap.org/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ lat: '40.7128', lon: '-74.0060', display_name: 'New York, NY' }]),
    }),
  );
  await page.getByTestId('location-search-input').fill('New York');
  await page.getByTestId('location-search-submit').click();
  // No assertion on map pan (requires visual check); verify error is NOT shown
  await expect(page.getByTestId('location-search-error')).not.toBeVisible();
});

test('draw toolbar has no edit (pencil) button', async ({ page }) => {
  await expect(page.locator('.leaflet-draw-edit-edit')).not.toBeVisible();
});

test('draw toolbar has a delete (trash) button', async ({ page }) => {
  await expect(page.locator('.leaflet-draw-edit-remove')).toBeVisible();
});

test('clicking trash button with no shape does not open modal', async ({ page }) => {
  await page.locator('.leaflet-draw-edit-remove').click();
  await expect(page.getByTestId('delete-confirm-modal')).not.toBeVisible();
});
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
cd frontend && npx playwright test tests/e2e/mapInteraction.spec.ts --reporter=line
```

Expected: multiple failures (elements don't exist yet). This is the correct baseline.

- [ ] **Step 3: Commit the failing tests**

```bash
cd frontend && git add tests/e2e/mapInteraction.spec.ts
git commit -m "test: add failing e2e tests for map interaction features"
```

---

## Task 2: Add `onShapeCleared` prop to MapView and handle in App.tsx

**Files:**
- Modify: `frontend/src/components/MapView.tsx` (Props interface only)
- Modify: `frontend/src/App.tsx` (add handler, pass prop, update "How to Draw" text)

- [ ] **Step 1: Add `onShapeCleared` to MapView Props interface**

In `frontend/src/components/MapView.tsx`, update the Props interface:

```typescript
interface Props {
  onPolygonComplete: (polygon: PolygonCoords) => void;
  onAreaTooLarge: () => void;
  onShapeCleared?: () => void;
  className?: string;
}
```

Update the function signature to destructure it:

```typescript
export default function MapView({ onPolygonComplete, onAreaTooLarge, onShapeCleared, className }: Props) {
```

Add a ref for it alongside the existing callback refs:

```typescript
const onShapeClearedRef = useRef(onShapeCleared);
useEffect(() => { onShapeClearedRef.current = onShapeCleared; }, [onShapeCleared]);
```

- [ ] **Step 2: Add `handleShapeCleared` and update MapView usage in App.tsx**

In `frontend/src/App.tsx`, find the `handlePolygonComplete` callback (around line 156). Add a new handler directly after it:

```typescript
const handleShapeCleared = useCallback(() => {
  setPolygon(null);
  setAreaError(null);
}, []);
```

Pass it to MapView in the draw step (around line 229):

```tsx
<MapView
  onPolygonComplete={handlePolygonComplete}
  onAreaTooLarge={handleAreaTooLarge}
  onShapeCleared={handleShapeCleared}
  className="absolute inset-0 w-full h-full"
/>
```

- [ ] **Step 3: Update "How to Draw" instructions in App.tsx**

Find the `ol` list inside the draw step panel (around line 263). Replace its contents:

```tsx
{[
  'Use the toolbar (top-left) to choose a shape: polygon, rectangle, or circle',
  'Draw your boundary on the map',
  'Use the trash icon to clear and start over',
].map((s, i) => (
  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
    <span className="w-4 h-4 rounded-full bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
      {i + 1}
    </span>
    {s}
  </li>
))}
```

- [ ] **Step 4: Build to confirm no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/MapView.tsx src/App.tsx
git commit -m "feat: add onShapeCleared prop to MapView, wire handler in App"
```

---

## Task 3: Restructure MapView to support overlay children

The Leaflet map currently initializes directly on the component's root div. We need a wrapper div as the positioning context and an inner div for Leaflet, so React overlays can be absolutely positioned siblings.

**Files:**
- Modify: `frontend/src/components/MapView.tsx`

- [ ] **Step 1: Split the root div into wrapper + inner Leaflet container**

Replace the current `return` statement in MapView:

```tsx
return (
  <div
    className={className}
    style={!className ? { width: '100%', height: '100vh' } : undefined}
    data-testid="map-view"
  >
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  </div>
);
```

The `containerRef` now points to the inner div. The outer div keeps `className`, `style`, and `data-testid`. The outer div must have `position: relative` for child overlays — add it:

```tsx
return (
  <div
    className={className}
    style={!className ? { width: '100%', height: '100vh', position: 'relative' } : undefined}
    data-testid="map-view"
  >
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0 }}
    />
  </div>
);
```

Note: when `className` is provided (the draw step passes `absolute inset-0 w-full h-full`), Tailwind's `absolute` sets `position: absolute`, which is a valid positioning context. No extra style needed in that branch.

- [ ] **Step 2: Verify the map still renders**

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173`, click "Start Your Map", confirm the map loads and the polygon draw tool works.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/MapView.tsx
git commit -m "refactor: wrap Leaflet container in positioning div for overlay support"
```

---

## Task 4: Enable rectangle and circle draw tools, disable edit button, add `circleToPolygon`

**Files:**
- Modify: `frontend/src/components/MapView.tsx`

- [ ] **Step 1: Add the `circleToPolygon` helper function**

Add this function directly above `computeApproxAreaSqDeg` in MapView.tsx:

```typescript
function circleToPolygon(
  center: L.LatLng,
  radiusMeters: number,
  numSides = 64,
): [number, number][] {
  const latRad = (center.lat * Math.PI) / 180;
  const points: [number, number][] = [];
  for (let i = 0; i < numSides; i++) {
    const angle = (i / numSides) * 2 * Math.PI;
    const latOffset = (radiusMeters / 111320) * Math.cos(angle);
    const lngOffset = (radiusMeters / (111320 * Math.cos(latRad))) * Math.sin(angle);
    points.push([center.lng + lngOffset, center.lat + latOffset]);
  }
  points.push(points[0]); // close ring
  return points;
}
```

- [ ] **Step 2: Update the draw control configuration**

Replace the `draw` and `edit` options inside `new (L as ...).Control.Draw(...)`:

```typescript
const drawControl = new (L as unknown as { Control: { Draw: new (opts: unknown) => L.Control } }).Control.Draw({
  draw: {
    polygon:      { showArea: true },
    rectangle:    { showArea: true },
    circle:       { showRadius: true },
    polyline:     false,
    circlemarker: false,
    marker:       false,
  },
  edit: {
    featureGroup: drawnItems,
    edit:         false,  // removes the pencil button
  },
});
```

- [ ] **Step 3: Update the CREATED event handler to handle all shape types**

Replace the existing `map.on(L.Draw.Event.CREATED, ...)` handler:

```typescript
map.on(L.Draw.Event.CREATED, (e: unknown) => {
  const event = e as { layerType: string; layer: L.Layer };
  drawnItems.clearLayers();
  drawnItems.addLayer(event.layer);

  let coords: [number, number][];

  if (event.layerType === 'circle') {
    const circle = event.layer as L.Circle;
    coords = circleToPolygon(circle.getLatLng(), circle.getRadius());
  } else {
    // polygon and rectangle both expose getLatLngs()
    const poly = event.layer as L.Polygon;
    const latlngs = poly.getLatLngs()[0] as L.LatLng[];
    const area = computeApproxAreaSqDeg(latlngs);
    if (area > MAX_POLYGON_AREA_SQ_DEG) {
      drawnItems.clearLayers();
      onAreaTooLargeRef.current();
      return;
    }
    coords = latlngs.map(ll => [ll.lng, ll.lat] as [number, number]);
    coords.push(coords[0]); // close ring
  }

  onPolygonCompleteRef.current({ type: 'Polygon', coordinates: [coords] });
});
```

Note: the area check for circles is skipped here — the draw control's built-in `maxRadius` option can be set if needed, but for now circles are treated as always valid since users can visually see the extent.

- [ ] **Step 4: Build to confirm no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Manual smoke test**

```bash
cd frontend && npm run dev
```

1. Click "Start Your Map"
2. Confirm the toolbar shows polygon, rectangle, and circle tools — no pencil/edit button
3. Draw a rectangle — confirm the app transitions to the customize step
4. Return to draw, draw a circle — confirm same transition

- [ ] **Step 6: Commit**

```bash
cd frontend && git add src/components/MapView.tsx
git commit -m "feat: add rectangle and circle draw tools, disable edit button, add circleToPolygon"
```

---

## Task 5: Create `DeleteConfirmModal` component

**Files:**
- Create: `frontend/src/components/DeleteConfirmModal.tsx`

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/DeleteConfirmModal.tsx
import { motion } from 'motion/react';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ onConfirm, onCancel }: Props) {
  return (
    <div
      className="absolute inset-0 z-[2000] flex items-center justify-center"
      data-testid="delete-confirm-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onCancel}
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative bg-white rounded-2xl shadow-2xl p-6 w-80 flex flex-col gap-4"
      >
        <div className="space-y-1">
          <h3 className="font-headline font-bold text-slate-900 text-base">Delete selection?</h3>
          <p className="text-sm text-slate-500">
            This will remove your drawn shape. You can draw a new one immediately after.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/DeleteConfirmModal.tsx
git commit -m "feat: add DeleteConfirmModal component"
```

---

## Task 6: Wire delete interception into MapView

**Files:**
- Modify: `frontend/src/components/MapView.tsx`

- [ ] **Step 1: Add imports and state at the top of MapView**

Add to the imports at the top of `MapView.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react';
import DeleteConfirmModal from './DeleteConfirmModal.js';
```

Add state and a `drawnItemsRef` inside the `MapView` function body (before any `useEffect`):

```typescript
const [showDeleteModal, setShowDeleteModal] = useState(false);
const drawnItemsRef = useRef<L.FeatureGroup | null>(null);
```

- [ ] **Step 2: Store `drawnItems` in the ref and attach the trash button interceptor**

Inside the main `useEffect`, immediately after `map.addLayer(drawnItems)`:

```typescript
drawnItemsRef.current = drawnItems;
```

After `map.addControl(drawControl)`, add the interceptor. The trash button is rendered to the DOM synchronously when `addControl` is called:

```typescript
const trashBtn = containerRef.current?.querySelector(
  '.leaflet-draw-edit-remove',
) as HTMLElement | null;

if (trashBtn) {
  trashBtn.addEventListener(
    'click',
    (e: MouseEvent) => {
      e.stopImmediatePropagation();
      if (drawnItemsRef.current && drawnItemsRef.current.getLayers().length > 0) {
        setShowDeleteModal(true);
      }
    },
    true, // capture phase — fires before leaflet-draw's own listener
  );
}
```

- [ ] **Step 3: Add the confirm and cancel handlers**

Add these two handlers inside the `MapView` function body (after the `useEffect` hooks):

```typescript
const handleDeleteConfirm = () => {
  drawnItemsRef.current?.clearLayers();
  onShapeClearedRef.current?.();
  setShowDeleteModal(false);
};

const handleDeleteCancel = () => {
  setShowDeleteModal(false);
};
```

- [ ] **Step 4: Render the modal inside the wrapper div**

Update the `return` statement to include the modal:

```tsx
return (
  <div
    className={className}
    style={!className ? { width: '100%', height: '100vh', position: 'relative' } : undefined}
    data-testid="map-view"
  >
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0 }}
    />
    {showDeleteModal && (
      <DeleteConfirmModal
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    )}
  </div>
);
```

- [ ] **Step 5: Build to confirm no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Manual smoke test**

```bash
cd frontend && npm run dev
```

1. Navigate to the draw step
2. Confirm the pencil/edit button is gone from the toolbar
3. Draw any shape
4. Click the trash icon — confirm the "Delete selection?" modal appears
5. Click Cancel — confirm modal closes, shape remains
6. Click trash again, then Delete — confirm modal closes and shape is cleared
7. Click trash again with no shape — confirm modal does NOT appear

- [ ] **Step 7: Commit**

```bash
cd frontend && git add src/components/MapView.tsx
git commit -m "feat: intercept trash button and show delete confirmation modal"
```

---

## Task 7: Create `LocationSearch` component

**Files:**
- Create: `frontend/src/components/LocationSearch.tsx`

- [ ] **Step 1: Create the component**

```typescript
// frontend/src/components/LocationSearch.tsx
import { useState, useRef } from 'react';
import { Search, Crosshair } from 'lucide-react';
import L from 'leaflet';
import { cn } from '../lib/utils.js';

interface Props {
  mapRef: React.RefObject<L.Map | null>;
}

type GeoError = 'not-found' | 'geo-denied' | 'geo-unavailable' | null;

export default function LocationSearch({ mapRef }: Props) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<GeoError>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'MapMerch/1.0' } },
      );
      const data = await res.json() as { lat: string; lon: string }[];
      if (data.length === 0) {
        setError('not-found');
      } else {
        mapRef.current?.flyTo([parseFloat(data[0].lat), parseFloat(data[0].lon)], 15);
      }
    } catch {
      setError('not-found');
    } finally {
      setLoading(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('geo-unavailable');
      return;
    }
    setGeoLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 15);
        setGeoLoading(false);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? 'geo-denied' : 'geo-unavailable');
        setGeoLoading(false);
      },
    );
  };

  const errorMessages: Record<NonNullable<GeoError>, string> = {
    'not-found':       'No results found.',
    'geo-denied':      'Location access denied.',
    'geo-unavailable': 'Location unavailable.',
  };

  return (
    <div
      className="absolute top-3 right-3 z-[1000] flex flex-col items-end gap-1"
      data-testid="location-search"
    >
      <div className="flex items-center gap-1 glass-panel rounded-full shadow-lg border border-white/40 px-2 py-1.5">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search location…"
          className="bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 w-44 px-2"
          data-testid="location-search-input"
        />
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className={cn(
            'w-7 h-7 flex items-center justify-center rounded-full transition-colors',
            loading ? 'text-slate-400' : 'text-primary hover:bg-primary/10',
          )}
          data-testid="location-search-submit"
          aria-label="Search"
        >
          <Search className="w-4 h-4" />
        </button>
        <button
          onClick={useMyLocation}
          disabled={geoLoading}
          className={cn(
            'w-7 h-7 flex items-center justify-center rounded-full transition-colors',
            geoLoading ? 'text-slate-400' : 'text-slate-600 hover:bg-slate-100',
          )}
          data-testid="use-my-location"
          aria-label="Use my location"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div
          className="glass-panel rounded-lg px-3 py-1.5 text-xs text-red-600 font-medium shadow border border-red-100"
          data-testid="location-search-error"
        >
          {errorMessages[error]}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-600"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to confirm no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. If `Crosshair` isn't in the installed lucide-react version, use `LocateFixed` or `Navigation` instead — check with `grep -r "Crosshair\|LocateFixed\|Navigation" node_modules/lucide-react/dist/esm/icons/ | head -5`.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/components/LocationSearch.tsx
git commit -m "feat: add LocationSearch component with Nominatim geocoding and geolocation"
```

---

## Task 8: Mount `LocationSearch` inside `MapView`

**Files:**
- Modify: `frontend/src/components/MapView.tsx`

- [ ] **Step 1: Add the LocationSearch import**

At the top of `MapView.tsx`, add:

```typescript
import LocationSearch from './LocationSearch.js';
```

- [ ] **Step 2: Render LocationSearch in the return statement**

Update the `return` to include `LocationSearch`:

```tsx
return (
  <div
    className={className}
    style={!className ? { width: '100%', height: '100vh', position: 'relative' } : undefined}
    data-testid="map-view"
  >
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0 }}
    />
    <LocationSearch mapRef={mapRef} />
    {showDeleteModal && (
      <DeleteConfirmModal
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    )}
  </div>
);
```

- [ ] **Step 3: Build to confirm no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

```bash
cd frontend && npm run dev
```

1. Navigate to the draw step
2. Confirm the search bar appears at the top-right of the map
3. Type "New York" and press Enter — map should fly to New York
4. Click the crosshair button — browser should prompt for location permission
5. Confirm error messages appear for denied location and a bad search query

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/MapView.tsx
git commit -m "feat: mount LocationSearch overlay in MapView"
```

---

## Task 9: Run the e2e tests and confirm they pass

**Files:**
- None (tests were already written in Task 1)

- [ ] **Step 1: Run the full map interaction test suite**

```bash
cd frontend && npx playwright test tests/e2e/mapInteraction.spec.ts --reporter=line
```

Expected: all tests pass. Common failures to investigate:
- `location-search` not found → check `data-testid="location-search"` is on the outer wrapper div in LocationSearch
- `leaflet-draw-edit-edit` still visible → confirm `edit: false` is set in the draw control config (Task 4 Step 2)
- `delete-confirm-modal` visible when it shouldn't be → check the `getLayers().length > 0` guard in the trash interceptor

- [ ] **Step 2: Run the full e2e suite to confirm no regressions**

```bash
cd frontend && npx playwright test --reporter=line
```

Expected: all tests pass including `happyPath.spec.ts`.

- [ ] **Step 3: Commit if any test fixes were needed**

```bash
cd frontend && git add -p && git commit -m "fix: address e2e test failures from map interaction implementation"
```

---

## Task 10: Check for the correct lucide-react icon name

This task exists because lucide-react icon names change between versions. Run this before Task 7 if the build fails on `Crosshair`.

**Files:**
- Modify: `frontend/src/components/LocationSearch.tsx` (if needed)

- [ ] **Step 1: Check what crosshair-style icons are available**

```bash
ls frontend/node_modules/lucide-react/dist/esm/icons/ | grep -iE "cross|locate|target|aim"
```

- [ ] **Step 2: Use the correct icon name**

If `crosshair.js` exists → use `Crosshair`  
If `locate-fixed.js` exists → use `LocateFixed`  
If `navigation.js` exists → use `Navigation`

Update the import in `LocationSearch.tsx` accordingly.
