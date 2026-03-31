import { toGeoJSON } from '../../src/services/geometryService.js';

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
