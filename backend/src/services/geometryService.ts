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

// ── Area-based road-density tiers ────────────────────────────────────────────
// Thresholds in square degrees (shoelace on raw lat/lng — same formula as the
// frontend). Adjust these values to tune which roads appear at each scale.
const TIER_ALL_SQ_DEG      = 0.005;  // < ~5×4 km  → all roads
const TIER_TERTIARY_SQ_DEG = 0.025;  // < ~15×10 km → tertiary and above
const TIER_PRIMARY_SQ_DEG  = 0.1;    // < ~30×22 km → primary and above
                                      // ≥ 0.1       → motorway + trunk only

function polygonAreaSqDeg(coords: [number, number][]): number {
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }
  return Math.abs(area) / 2;
}

function highwayFilter(areaSqDeg: number): string {
  if (areaSqDeg < TIER_ALL_SQ_DEG) {
    return '"highway"';
  }
  if (areaSqDeg < TIER_TERTIARY_SQ_DEG) {
    return '"highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified)$"';
  }
  if (areaSqDeg < TIER_PRIMARY_SQ_DEG) {
    return '"highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link)$"';
  }
  return '"highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link)$"';
}

function buildOverpassQuery(polygon: GeoJSONPolygon): string {
  const coords = polygon.coordinates[0] as [number, number][];
  const polyStr = coords.map(([lng, lat]) => `${lat} ${lng}`).join(' ');
  const filter  = highwayFilter(polygonAreaSqDeg(coords));
  return `[out:json][timeout:60];(way[${filter}](poly:"${polyStr}"););out geom;`;
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
