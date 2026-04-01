import { generateSvg } from '../../src/services/artEngine.js';
import { GeoJSONFeatureCollection, WaterRing } from '../../src/types.js';

const sampleStreetData: GeoJSONFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-87.6298, 41.8781],
          [-87.6248, 41.8831],
        ],
      },
      properties: {},
    },
  ],
};

describe('generateSvg', () => {
  it('returns a valid SVG string', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('<path');
  });

  it('uses the correct background color for minimal-line-art', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art');
    expect(svg).toContain('fill="#ffffff"');
  });

  it('uses the correct background color for blueprint', () => {
    const svg = generateSvg(sampleStreetData, 'blueprint');
    expect(svg).toContain('fill="#1a3a5c"');
  });

  it('uses the correct background color for watercolor-wash', () => {
    const svg = generateSvg(sampleStreetData, 'watercolor-wash');
    expect(svg).toContain('fill="#f5f0e8"');
  });

  it('uses the correct background color for bold-graphic', () => {
    const svg = generateSvg(sampleStreetData, 'bold-graphic');
    expect(svg).toContain('fill="#1a1a1a"');
  });

  it('throws when feature collection is empty', () => {
    const empty: GeoJSONFeatureCollection = { type: 'FeatureCollection', features: [] };
    expect(() => generateSvg(empty, 'minimal-line-art')).toThrow('No street data to render');
  });

  it('outputs SVG with correct viewBox for 2400px canvas', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art');
    expect(svg).toContain('viewBox="0 0 2400 2400"');
  });

  it('stamps paths with road group class when groupMap provided', () => {
    const data: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-87.6298, 41.8781], [-87.6248, 41.8831]] },
        properties: { highway: 'motorway' },
      }],
    };
    const svg = generateSvg(data, 'minimal-line-art', 24, { motorway: 'major' });
    expect(svg).toContain('class="road-major"');
  });

  it('falls back to road-local class when highway type not in groupMap', () => {
    const data: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[-87.6298, 41.8781], [-87.6248, 41.8831]] },
        properties: { highway: 'unknown_type' },
      }],
    };
    const svg = generateSvg(data, 'minimal-line-art', 24, { motorway: 'major' });
    expect(svg).toContain('class="road-local"');
  });

  it('uses road-local class when feature has no highway property', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, { motorway: 'major' });
    expect(svg).toContain('class="road-local"');
  });
});

describe('generateSvg with water rings', () => {
  const sampleWater: WaterRing[] = [
    [
      [-87.635, 41.875],
      [-87.625, 41.875],
      [-87.625, 41.885],
      [-87.635, 41.885],
      [-87.635, 41.875],
    ],
  ];

  it('renders water-body paths before road paths', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, {}, sampleWater);
    const waterIdx = svg.indexOf('class="water-body"');
    const roadIdx = svg.indexOf('class="road-');
    expect(waterIdx).toBeGreaterThanOrEqual(0);
    expect(roadIdx).toBeGreaterThanOrEqual(0);
    expect(waterIdx).toBeLessThan(roadIdx);
  });

  it('water paths use default gray fill and no stroke', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, {}, sampleWater);
    expect(svg).toContain('class="water-body"');
    expect(svg).toContain('fill="#bfbfbf"');
    expect(svg).toContain('stroke="none"');
  });

  it('generates valid SVG with no water rings when 5th arg omitted (backward compat)', () => {
    const svg = generateSvg(sampleStreetData, 'minimal-line-art');
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('class="water-body"');
  });

  it('skips rings with fewer than 3 points', () => {
    const shortRing: WaterRing[] = [[[-87.635, 41.875], [-87.625, 41.875]]];
    const svg = generateSvg(sampleStreetData, 'minimal-line-art', 24, {}, shortRing);
    expect(svg).not.toContain('class="water-body"');
  });
});
