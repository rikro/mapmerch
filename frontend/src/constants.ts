import { StyleOption, ProductOption, StreetGroupId, StreetConfig } from './types.js';

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

export const STREET_GROUPS: { id: StreetGroupId; label: string; types: string[]; defaultOn: boolean }[] = [
  { id: 'major',      label: 'Major Roads',   types: ['motorway', 'trunk', 'primary'],                 defaultOn: true  },
  { id: 'secondary',  label: 'Secondary',     types: ['secondary', 'tertiary'],                         defaultOn: true  },
  { id: 'local',      label: 'Local Streets', types: ['residential', 'unclassified', 'living_street'],  defaultOn: true  },
  { id: 'pedestrian', label: 'Pedestrian',    types: ['pedestrian', 'footway', 'path'],                 defaultOn: false },
  { id: 'cycling',    label: 'Cycling',       types: ['cycleway'],                                      defaultOn: false },
  { id: 'service',    label: 'Service Roads', types: ['service'],                                       defaultOn: false },
];

export const DEFAULT_STREET_CONFIG: StreetConfig = {
  enabledGroups: STREET_GROUPS.filter(g => g.defaultOn).map(g => g.id),
  groupStyles: {
    major:      { strokeWidth: 4,   dashStyle: 'solid',  color: null },
    secondary:  { strokeWidth: 2.5, dashStyle: 'solid',  color: null },
    local:      { strokeWidth: 1.5, dashStyle: 'solid',  color: null },
    pedestrian: { strokeWidth: 1,   dashStyle: 'dotted', color: null },
    cycling:    { strokeWidth: 1,   dashStyle: 'dashed', color: null },
    service:    { strokeWidth: 1,   dashStyle: 'solid',  color: null },
  },
};
