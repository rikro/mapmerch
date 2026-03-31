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
