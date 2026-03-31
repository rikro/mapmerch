# Per-Group Street Styling — Design Spec

**Date:** 2026-03-31  
**Status:** Approved

## Overview

Replace the single global stroke-weight/dash-style controls with full per-road-type styling. Each of the six street groups (Major, Secondary, Local, Pedestrian, Cycling, Service) gets independent stroke weight, dash style, and color. The on/off toggle is replaced by a styled checkbox on the left of each row, and an inline accordion expands to reveal the three controls.

---

## 1. Data Model

### `types.ts`

Add `StreetGroupStyle`, update `StreetConfig`:

```typescript
export interface StreetGroupStyle {
  strokeWidth: number;
  dashStyle: DashStyle;
  color: string | null; // null = follow theme (no CSS override)
}

export interface StreetConfig {
  enabledGroups: StreetGroupId[];
  groupStyles: Record<StreetGroupId, StreetGroupStyle>;
  // Removed: strokeWidth, dashStyle (now per-group)
}
```

### `constants.ts`

`DEFAULT_STREET_CONFIG` provides tiered defaults:

| Group      | strokeWidth | dashStyle | color |
|------------|-------------|-----------|-------|
| major      | 4           | solid     | null  |
| secondary  | 2.5         | solid     | null  |
| local      | 1.5         | solid     | null  |
| pedestrian | 1           | dotted    | null  |
| cycling    | 1           | dashed    | null  |
| service    | 1           | solid     | null  |

---

## 2. Backend

### `artEngine.ts`

- `renderPaths` gains a `groupMap: Record<string, string>` parameter (highway type → group ID).
- Each rendered `<path>` gets `class="road-{groupId}"` (e.g. `class="road-major"`).
- The preset `strokeWidth` embedded on the path element remains as the theme fallback; the frontend CSS overrides it per-group.
- `generateSvg` signature: `generateSvg(streetData, style, labelOffset, groupMap)`.

### `backend/src/types.ts`

`GenerateArtworkRequest` gains:

```typescript
groupMap?: Record<string, string>; // e.g. { motorway: 'major', residential: 'local' }
```

### `artwork.ts` route

Passes `groupMap` from request body to `generateSvg`. No other route changes.

---

## 3. Frontend — `applyStreetStyle` (App.tsx)

Replaces the single `path[fill="none"]` global rule with per-group CSS rules:

```typescript
function applyStreetStyle(rawSvg, config, labelTypography) {
  if (!rawSvg) return null;

  const groupRules = STREET_GROUPS
    .filter(g => config.enabledGroups.includes(g.id))
    .map(g => {
      const s = config.groupStyles[g.id];
      const dash = DASH_ARRAYS[s.dashStyle];
      return [
        `path.road-${g.id}{`,
        `stroke-width:${s.strokeWidth};`,
        dash ? `stroke-dasharray:${dash};` : '',
        s.color ? `stroke:${s.color};` : '',
        `}`,
      ].join('');
    })
    .join('');

  const textRules = `text{font-family:${labelTypography.typeface},sans-serif;font-size:${labelTypography.size}px;font-weight:${labelTypography.weight};${labelTypography.color ? `fill:${labelTypography.color}` : ''}}`;
  return rawSvg.replace(/(<svg[^>]*>)/, `$1<style>${groupRules}${textRules}</style>`);
}
```

Groups not in `enabledGroups` get no rule — paths remain at the theme default, but the backend already filters them out so they won't be in the SVG.

---

## 4. Frontend — App.tsx State & Handlers

### Helper replacing `resolvedHighwayTypes`

```typescript
function resolvedStreetArgs(config: StreetConfig) {
  const enabled = STREET_GROUPS.filter(g => config.enabledGroups.includes(g.id));
  const highwayTypes = enabled.flatMap(g => g.types);
  const groupMap: Record<string, string> = {};
  enabled.forEach(g => g.types.forEach(t => { groupMap[t] = g.id; }));
  return { highwayTypes, groupMap };
}
```

Both `highwayTypes` and `groupMap` are passed to `generate()` calls.

### Regeneration rule

- `enabledGroups` change → triggers `generate()` (backend round-trip, same as today).
- `groupStyles` change (weight, dash, color) → only reruns `applyStreetStyle` on existing SVG. No backend call. Instant.

### Per-group style update pattern (from StudioPanel)

```typescript
onStreetConfigChange({
  groupStyles: {
    ...streetConfig.groupStyles,
    [groupId]: { ...streetConfig.groupStyles[groupId], strokeWidth: newVal }
  }
})
```

No new props needed on `StudioPanel`.

---

## 5. UI — StudioPanel.tsx (Streets Tab)

### What's removed
- Global "Line Weight" slider
- Global "Line Style" dash buttons

### What's added / changed

**Street Types section:**

Each group row:
```
[checkbox] [Group Name]   [mini line preview]  [▼ chevron]
```

- **Checkbox** (left): styled 17×17px rounded square. Checked = filled blue. Unchecked = empty grey border. Clicking toggles `enabledGroups` (triggers regeneration).
- **Mini line preview**: a short horizontal line segment reflecting current `strokeWidth` (visual thickness) and `dashStyle` (solid/dashed/dotted). Fades to 30% opacity when group is unchecked.
- **Chevron** (right): toggles the inline accordion. Works independently of the checkbox — you can expand a disabled group to pre-configure its style.

**Expanded inline controls (under the row, indented):**

1. **Weight** — range slider, 1–12px, 0.5 step. Shows current value right-aligned.
2. **Style** — three pill buttons: `—` (solid) / `╌╌` (dashed) / `···` (dotted).
3. **Color** — row of swatches: `Auto` (null, follows theme) + the 6 existing color swatches from `COLOR_SWATCHES`. `Auto` is a crosshatch/dashed-border swatch.

Multiple groups can be expanded simultaneously.

**Hint text** below the list:
> "Toggling a street type regenerates the artwork. Style changes (weight, dash, color) apply instantly."

---

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/types.ts` | Add `StreetGroupStyle`, update `StreetConfig` |
| `frontend/src/constants.ts` | Update `DEFAULT_STREET_CONFIG` with per-group defaults |
| `frontend/src/App.tsx` | Replace `resolvedHighwayTypes`, rewrite `applyStreetStyle`, update `generate()` calls |
| `frontend/src/api/client.ts` | Add `groupMap` to generate request |
| `frontend/src/components/StudioPanel.tsx` | Replace global controls + Toggle with checkbox accordion UI |
| `backend/src/types.ts` | Add `groupMap` to `GenerateArtworkRequest` |
| `backend/src/services/artEngine.ts` | Add `groupMap` param, stamp paths with `class="road-{groupId}"` |
| `backend/src/routes/artwork.ts` | Pass `groupMap` to `generateSvg` |
