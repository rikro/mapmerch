import { StyleOption, ProductOption } from './types.js';

export const STYLE_OPTIONS: StyleOption[] = [
  { name: 'minimal-line-art', label: 'Minimal', backgroundColor: '#ffffff', strokeColor: '#000000' },
  { name: 'blueprint',        label: 'Blueprint', backgroundColor: '#1a3a5c', strokeColor: '#a8c8f0' },
  { name: 'watercolor-wash',  label: 'Watercolor', backgroundColor: '#f5f0e8', strokeColor: '#8b6f47' },
  { name: 'bold-graphic',     label: 'Bold',      backgroundColor: '#1a1a1a', strokeColor: '#f5c518' },
];

export const PRODUCT_OPTIONS: ProductOption[] = [
  {
    type: 'print',
    label: 'Fine Art Print',
    sizes: ['8x8', '12x12', '16x16'],
    retailPriceCents: { '8x8': 2500, '12x12': 3500, '16x16': 4500 },
  },
  {
    type: 'poster',
    label: 'Poster',
    sizes: ['12x18', '18x24'],
    retailPriceCents: { '12x18': 3000, '18x24': 4000 },
  },
  {
    type: 'canvas',
    label: 'Canvas Print',
    sizes: ['8x8', '12x12', '16x16'],
    retailPriceCents: { '8x8': 5500, '12x12': 7500, '16x16': 9500 },
  },
];

// Max polygon area in square degrees (~roughly 5km² depending on latitude)
export const MAX_POLYGON_AREA_SQ_DEG = 0.001;
