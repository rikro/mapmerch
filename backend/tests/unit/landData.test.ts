import { _fetchLandGeometryFromFeatures } from '../../src/data/landData.js';
import { GeoJSONPolygon } from '../../src/types.js';

// A simple square land polygon: lon 0–10, lat 10–20
const mockPolygons = [
  { coordinates: [[[0, 10], [10, 10], [10, 20], [0, 20], [0, 10]]] as [number, number][][], bbox: { minLng: 0, maxLng: 10, minLat: 10, maxLat: 20 } },
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
  it('returns rings when drawn polygon is entirely inside a land polygon', () => {
    const rings = _fetchLandGeometryFromFeatures(mockPolygons, drawnOverLand);
    expect(rings.length).toBeGreaterThan(0);
    for (const ring of rings) {
      for (const [lng] of ring) {
        expect(lng).toBeGreaterThanOrEqual(2);
        expect(lng).toBeLessThanOrEqual(8);
      }
    }
  });

  it('returns empty array when drawn polygon does not intersect any land polygon', () => {
    const rings = _fetchLandGeometryFromFeatures(mockPolygons, drawnOverOcean);
    expect(rings).toEqual([]);
  });

  it('returns clipped ring when drawn polygon straddles a land boundary', () => {
    const rings = _fetchLandGeometryFromFeatures(mockPolygons, drawnStraddling);
    expect(rings.length).toBeGreaterThan(0);
    for (const ring of rings) {
      for (const [lng] of ring) {
        expect(lng).toBeGreaterThanOrEqual(0 - 0.0001);
      }
    }
  });

  it('returns empty array when polygon list is empty', () => {
    const rings = _fetchLandGeometryFromFeatures([], drawnOverLand);
    expect(rings).toEqual([]);
  });

  it('returns rings from multiple land polygons (MultiPolygon-style input)', () => {
    const twoPolygons = [
      {
        coordinates: [[[0, 10], [10, 10], [10, 20], [0, 20], [0, 10]]] as [number, number][][],
        bbox: { minLng: 0, maxLng: 10, minLat: 10, maxLat: 20 },
      },
      {
        coordinates: [[[20, 10], [30, 10], [30, 20], [20, 20], [20, 10]]] as [number, number][][],
        bbox: { minLng: 20, maxLng: 30, minLat: 10, maxLat: 20 },
      },
    ];
    // Drawn polygon overlaps only the first land square
    const drawn: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [[[2, 12], [8, 12], [8, 18], [2, 18], [2, 12]]],
    };
    const rings = _fetchLandGeometryFromFeatures(twoPolygons, drawn);
    expect(rings.length).toBeGreaterThan(0);
    // All returned coordinates must be within the first land square (lng 0–10)
    for (const ring of rings) {
      for (const [lng] of ring) {
        expect(lng).toBeGreaterThanOrEqual(0);
        expect(lng).toBeLessThanOrEqual(10);
      }
    }
  });
});
