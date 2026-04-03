import { GeoJSONFeatureCollection, GeoJSONPolygon, StyleName, StylePreset, WaterRing, LandRing } from '../types.js';
import { getStylePreset } from './stylePresets.js';

const CANVAS_SIZE = 2400; // px — 8in at 300dpi, scales to any square product
const LABEL_FONT_SIZE = 40;
const LABEL_DEFAULT_OFFSET_PX = 24; // perpendicular offset from the street line
const LABEL_MIN_SEGMENT_PX = 200;  // skip labels on segments too short to read comfortably
const LABEL_OPACITY = 0.65;
const WATER_DEFAULT_FILL = '#bfbfbf'; // 25% gray (75% lightness)

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

function toSvgCoords(
  lng: number,
  lat: number,
  bbox: BoundingBox,
  padding: number,
): [number, number] {
  const usableSize = CANVAS_SIZE - padding * 2;
  const lngRange = bbox.maxLng - bbox.minLng || 0.001;
  const latRange = bbox.maxLat - bbox.minLat || 0.001;

  // At latitude φ, 1° longitude = cos(φ) × 1° latitude in real-world distance.
  // Without this correction the map is stretched horizontally at non-equatorial latitudes.
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  const cosLat = Math.cos(midLat * Math.PI / 180);

  const scale = Math.min(usableSize / (lngRange * cosLat), usableSize / latRange);
  const x = padding + (lng - bbox.minLng) * cosLat * scale;
  const y = padding + (bbox.maxLat - lat) * scale; // Y-axis flip: north is up
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

// Chaikin's corner-cutting algorithm: each iteration replaces every segment with two new
// points at the 25% and 75% positions, rounding off corners. This is the key step for
// smoothing sparsely-sampled OSM roads — Catmull-Rom alone can't help when a segment
// has only 2-3 nodes. Two iterations give a good balance of smoothness vs. SVG size.
function chaikinSmooth(pts: [number, number][], iterations = 2): [number, number][] {
  if (pts.length < 3) return pts;
  let result = pts;
  for (let iter = 0; iter < iterations; iter++) {
    const next: [number, number][] = [result[0]];
    for (let i = 0; i < result.length - 1; i++) {
      const [x0, y0] = result[i];
      const [x1, y1] = result[i + 1];
      next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1]);
      next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    next.push(result[result.length - 1]);
    result = next;
  }
  return result;
}

// Densify with Chaikin then thread a Catmull-Rom cubic Bézier through the result.
// Chaikin handles sparse-node roads (rounds corners); Catmull-Rom adds micro-smoothness
// between the densified points without further inflating SVG size.
function smoothedPathD(pts: [number, number][]): string {
  if (pts.length < 2) return '';

  const dense = chaikinSmooth(pts);

  if (dense.length === 2) {
    return `M ${dense[0][0]},${dense[0][1]} L ${dense[1][0]},${dense[1][1]}`;
  }

  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M ${dense[0][0]},${dense[0][1]}`;

  for (let i = 0; i < dense.length - 1; i++) {
    const p0 = dense[Math.max(0, i - 1)];
    const p1 = dense[i];
    const p2 = dense[i + 1];
    const p3 = dense[Math.min(dense.length - 1, i + 2)];

    // Catmull-Rom → cubic Bézier control points (tension = 1/6)
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d += ` C ${r(cp1x)},${r(cp1y)} ${r(cp2x)},${r(cp2y)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function segmentPixelLength(pts: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

// Reverse the point list if the segment runs right-to-left so that textPath
// content reads left-to-right rather than appearing upside-down.
function orientedForText(pts: [number, number][]): [number, number][] {
  const dx = pts[pts.length - 1][0] - pts[0][0];
  return dx < 0 ? [...pts].reverse() : pts;
}

// Shift each point perpendicular-left of the direction of travel by offsetPx.
// In SVG coordinates (Y increases downward), for a rightward path this is upward (−Y),
// so positive offsetPx consistently places text above the street line.
function parallelOffsetPath(pts: [number, number][], offsetPx: number): [number, number][] {
  return pts.map((pt, i) => {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const len = Math.sqrt(tx * tx + ty * ty);
    if (len === 0) return pt;
    tx /= len;
    ty /= len;
    // Left-of-travel normal in SVG space: rotate tangent 90° CCW → (ty, −tx).
    // Verification: tangent (1,0) → normal (0,−1) = up in SVG ✓
    return [pt[0] + ty * offsetPx, pt[1] - tx * offsetPx];
  });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

function renderWaterBodies(
  waterRings: WaterRing[],
  bbox: BoundingBox,
  preset: StylePreset,
): string {
  if (waterRings.length === 0) return '';
  return waterRings
    .map(ring => {
      const pts = ring.map(([lng, lat]) => toSvgCoords(lng, lat, bbox, preset.padding));
      if (pts.length < 3) return '';
      const d = `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
      return `  <path class="water-body" d="${d}" fill="${WATER_DEFAULT_FILL}" stroke="none"/>`;
    })
    .filter(Boolean)
    .join('\n');
}

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

function renderClipPath(polygon: GeoJSONPolygon, bbox: BoundingBox, padding: number): string {
  const pts = polygon.coordinates[0].map(([lng, lat]) => toSvgCoords(lng, lat, bbox, padding));
  const d = `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
  return `    <clipPath id="frame">\n      <path d="${d}"/>\n    </clipPath>`;
}

function renderBoundaryBorder(polygon: GeoJSONPolygon, bbox: BoundingBox, padding: number): string {
  const pts = polygon.coordinates[0].map(([lng, lat]) => toSvgCoords(lng, lat, bbox, padding));
  const d = `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`;
  return `  <path class="boundary-border" d="${d}" fill="none"/>`;
}

function renderStreetLabels(
  features: GeoJSONFeatureCollection['features'],
  bbox: BoundingBox,
  preset: StylePreset,
  labelOffset: number,
): string {
  // OSM splits named roads into many short way segments. For each distinct name,
  // keep only the longest segment so each road is labeled exactly once.
  const best = new Map<string, { pts: [number, number][]; length: number }>();

  for (const feature of features) {
    const name = feature.properties['name'];
    if (typeof name !== 'string' || !name.trim()) continue;

    const pts = feature.geometry.coordinates.map(
      ([lng, lat]) => toSvgCoords(lng, lat, bbox, preset.padding),
    );
    const length = segmentPixelLength(pts);
    if (length < LABEL_MIN_SEGMENT_PX) continue;

    const existing = best.get(name);
    if (!existing || length > existing.length) {
      best.set(name, { pts, length });
    }
  }

  if (best.size === 0) return '';

  const defs: string[] = [];
  const texts: string[] = [];
  let id = 0;

  for (const [name, { pts }] of best) {
    const pathId = `sn${id++}`;
    const oriented = orientedForText(pts);
    const offset = parallelOffsetPath(oriented, labelOffset);
    const d = smoothedPathD(offset);
    defs.push(`    <path id="${pathId}" d="${d}"/>`);
    texts.push(
      `  <text font-family="sans-serif" font-size="${LABEL_FONT_SIZE}" fill="${preset.strokeColor}" opacity="${LABEL_OPACITY}">` +
      `<textPath href="#${pathId}" startOffset="50%" text-anchor="middle">${escapeXml(name)}</textPath></text>`,
    );
  }

  return `  <defs>\n${defs.join('\n')}\n  </defs>\n${texts.join('\n')}`;
}

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

    const border = renderBoundaryBorder(drawnPolygon, bbox, preset.padding);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <defs>
${clipPath}
  </defs>
  <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="white"/>
  <g clip-path="url(#frame)">
    <rect class="canvas-bg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${preset.backgroundColor}"/>
    <rect class="water-bg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${WATER_DEFAULT_FILL}"/>
${land ? land + '\n' : ''}${water ? water + '\n' : ''}${paths}
${labels}
  </g>
${border}
</svg>`;
  }

  // Legacy path — no polygon provided (used by existing tests and backward-compat callers)
  const bbox = getBoundingBox(streetData.features);
  const water = renderWaterBodies(waterRings, bbox, preset);
  const paths = renderPaths(streetData.features, bbox, preset, groupMap);
  const labels = renderStreetLabels(streetData.features, bbox, preset, labelOffset);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <rect class="canvas-bg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${preset.backgroundColor}"/>
${water ? water + '\n' : ''}${paths}
${labels}
</svg>`;
}
