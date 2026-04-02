import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon } from 'polygon-clipping';
import { GeoJSONPolygon, LandRing } from '../types.js';

function resolveDataPath(): string {
  const cwd = process.cwd();
  const srcPath = join(cwd, 'src', 'data', 'ne_10m_land.json');
  if (existsSync(srcPath)) return srcPath;
  const distPath = join(cwd, 'dist', 'data', 'ne_10m_land.json');
  if (existsSync(distPath)) return distPath;
  throw new Error('ne_10m_land.json not found. Run from the backend/ directory.');
}

const rawData = JSON.parse(readFileSync(resolveDataPath(), 'utf-8'));

interface BoundingBox {
  minLng: number; maxLng: number;
  minLat: number; maxLat: number;
}

interface LandPolygon {
  coordinates: [number, number][][]; // [outerRing, ...holeRings] — GeoJSON Polygon format
  bbox: BoundingBox;
}

function computeBbox(ring: [number, number][]): BoundingBox {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, maxLng, minLat, maxLat };
}

// Use the base global feature (min_zoom=0). It contains the continental polygons
// (Americas, Eurasia, Africa, etc.) and provides complete worldwide land coverage.
// Using only this feature keeps per-request intersection cost manageable.
function getBaseFeaturePolygons(features: unknown[]): [number, number][][][] {
  for (const f of features as { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[]) {
    if (f.properties?.min_zoom === 0 && f.geometry.type === 'MultiPolygon') {
      return f.geometry.coordinates as [number, number][][][];
    }
  }
  // Fallback: first MultiPolygon feature
  for (const f of features as { geometry: { type: string; coordinates: unknown } }[]) {
    if (f.geometry.type === 'MultiPolygon') {
      return f.geometry.coordinates as [number, number][][][];
    }
  }
  return [];
}

// Explode the base feature into individual polygons with precomputed bboxes.
const detailedPolygons: LandPolygon[] = getBaseFeaturePolygons(rawData.features).map(
  polygonCoords => ({
    coordinates: polygonCoords,
    bbox: computeBbox(polygonCoords[0]), // outer ring determines bbox
  }),
);

function bboxOverlaps(landBbox: BoundingBox, polygon: GeoJSONPolygon): boolean {
  const pCoords = polygon.coordinates[0];
  const pLngs = pCoords.map(([lng]) => lng);
  const pLats = pCoords.map(([, lat]) => lat);
  const pMinLng = Math.min(...pLngs), pMaxLng = Math.max(...pLngs);
  const pMinLat = Math.min(...pLats), pMaxLat = Math.max(...pLats);
  return !(
    landBbox.maxLng < pMinLng || landBbox.minLng > pMaxLng ||
    landBbox.maxLat < pMinLat || landBbox.minLat > pMaxLat
  );
}

function intersectLandPolygon(land: LandPolygon, drawnPolygon: GeoJSONPolygon): LandRing[] {
  const drawn: MultiPolygon = [drawnPolygon.coordinates as unknown as Polygon];
  const landCoords: MultiPolygon = [land.coordinates as unknown as Polygon];

  let result: MultiPolygon;
  try {
    result = polygonClipping.intersection(drawn, landCoords);
  } catch {
    return [];
  }

  // Take only the outer ring of each resulting polygon; holes (inner rings) are intentionally
  // dropped — the water rendering model fills all non-land areas with water, so islands
  // within water bodies will be rendered as water, which is acceptable at city scale.
  return result.map(poly => poly[0] as LandRing);
}

// Exported for unit testing with fixture data
export function _fetchLandGeometryFromFeatures(
  polygons: LandPolygon[],
  drawnPolygon: GeoJSONPolygon,
): LandRing[] {
  const rings: LandRing[] = [];
  for (const land of polygons) {
    if (!bboxOverlaps(land.bbox, drawnPolygon)) continue;
    rings.push(...intersectLandPolygon(land, drawnPolygon));
  }
  return rings.filter(ring => ring.length >= 3);
}

export function fetchLandGeometry(polygon: GeoJSONPolygon): LandRing[] {
  return _fetchLandGeometryFromFeatures(detailedPolygons, polygon);
}
