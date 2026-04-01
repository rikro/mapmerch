import { toGeoJSON, toWaterRings } from '../../src/services/geometryService.js';

describe('toGeoJSON', () => {
  it('converts overpass way elements to GeoJSON FeatureCollection', () => {
    const overpassResponse = {
      elements: [
        {
          type: 'way',
          id: 1,
          geometry: [
            { lat: 41.8781, lon: -87.6298 },
            { lat: 41.8831, lon: -87.6248 },
          ],
          tags: { highway: 'residential', name: 'Main St' },
        },
      ],
    };

    const result = toGeoJSON(overpassResponse);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0].geometry.type).toBe('LineString');
    expect(result.features[0].geometry.coordinates).toEqual([
      [-87.6298, 41.8781],
      [-87.6248, 41.8831],
    ]);
    expect(result.features[0].properties).toEqual({
      highway: 'residential',
      name: 'Main St',
    });
  });

  it('filters out non-way elements', () => {
    const overpassResponse = {
      elements: [
        { type: 'node', id: 2, geometry: [{ lat: 41.8781, lon: -87.6298 }] },
      ],
    };
    const result = toGeoJSON(overpassResponse);
    expect(result.features).toHaveLength(0);
  });

  it('filters out ways without geometry', () => {
    const overpassResponse = {
      elements: [{ type: 'way', id: 3, tags: { highway: 'residential' } }],
    };
    const result = toGeoJSON(overpassResponse);
    expect(result.features).toHaveLength(0);
  });

  it('returns empty FeatureCollection for empty elements array', () => {
    const result = toGeoJSON({ elements: [] });
    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(0);
  });
});

describe('toWaterRings', () => {
  it('converts a way element to a coordinate ring [lng, lat]', () => {
    const response = {
      elements: [{
        type: 'way',
        id: 1,
        geometry: [
          { lat: 41.8781, lon: -87.6298 },
          { lat: 41.8831, lon: -87.6248 },
          { lat: 41.8781, lon: -87.6298 },
        ],
      }],
    };
    const rings = toWaterRings(response);
    expect(rings).toHaveLength(1);
    expect(rings[0]).toEqual([
      [-87.6298, 41.8781],
      [-87.6248, 41.8831],
      [-87.6298, 41.8781],
    ]);
  });

  it('extracts outer member rings from a relation element', () => {
    const response = {
      elements: [{
        type: 'relation',
        id: 2,
        tags: { natural: 'water', type: 'multipolygon' },
        members: [
          {
            type: 'way', ref: 10, role: 'outer',
            geometry: [
              { lat: 42.0, lon: -87.7 },
              { lat: 42.1, lon: -87.7 },
              { lat: 42.1, lon: -87.6 },
              { lat: 42.0, lon: -87.7 },
            ],
          },
          {
            type: 'way', ref: 11, role: 'inner',
            geometry: [
              { lat: 42.05, lon: -87.68 },
              { lat: 42.06, lon: -87.68 },
              { lat: 42.05, lon: -87.68 },
            ],
          },
        ],
      }],
    };
    const rings = toWaterRings(response);
    // Only the outer ring is included; inner (island) is skipped.
    expect(rings).toHaveLength(1);
    expect(rings[0]).toEqual([
      [-87.7, 42.0],
      [-87.7, 42.1],
      [-87.6, 42.1],
      [-87.7, 42.0],
    ]);
  });

  it('skips way elements with fewer than 3 points', () => {
    const response = {
      elements: [{ type: 'way', id: 3, geometry: [{ lat: 41.8, lon: -87.6 }, { lat: 41.9, lon: -87.5 }] }],
    };
    expect(toWaterRings(response)).toHaveLength(0);
  });

  it('skips relation members with fewer than 3 points', () => {
    const response = {
      elements: [{
        type: 'relation', id: 4, members: [
          { type: 'way', ref: 5, role: 'outer', geometry: [{ lat: 41.8, lon: -87.6 }] },
        ],
      }],
    };
    expect(toWaterRings(response)).toHaveLength(0);
  });

  it('filters out non-way, non-relation elements', () => {
    const response = {
      elements: [{ type: 'node', id: 6, geometry: [{ lat: 41.8781, lon: -87.6298 }] }],
    };
    expect(toWaterRings(response)).toHaveLength(0);
  });

  it('returns empty array for empty elements', () => {
    expect(toWaterRings({ elements: [] })).toEqual([]);
  });
});
