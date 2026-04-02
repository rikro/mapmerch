import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import polygonClipping from 'polygon-clipping';
import type { MultiPolygon, Polygon } from 'polygon-clipping';
import { GeoJSONPolygon, LandRing } from '../types.js';

const rawData = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'data', 'ne_10m_land.json'), 'utf-8'),
);

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

// Pick the most detailed feature: the MultiPolygon with the most sub-polygons.
// The Natural Earth file has 11 features at different zoom/detail levels;
// the one with the most sub-polygons (Feature 7, ~2773) is the most granular.
function pickMostDetailedFeature(features: unknown[]): [number, number][][][] {
  let best: [number, number][][][] = [];
  for (const f of features as { geometry: { type: string; coordinates: unknown } }[]) {
    if (f.geometry.type !== 'MultiPolygon') continue;
    const coords = f.geometry.coordinates as [number, number][][][];
    if (coords.length > best.length) best = coords;
  }
  return best;
}

// Explode the chosen MultiPolygon into individual polygons with precomputed bboxes.
const detailedPolygons: LandPolygon[] = pickMostDetailedFeature(rawData.features).map(
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

  // Take only the outer ring of each resulting polygon
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
