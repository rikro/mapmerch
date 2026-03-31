import { StyleName, StylePreset } from '../types.js';

const presets: Record<StyleName, StylePreset> = {
  'minimal-line-art': {
    name: 'minimal-line-art',
    backgroundColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 3,
    padding: 120,
  },
  'blueprint': {
    name: 'blueprint',
    backgroundColor: '#1a3a5c',
    strokeColor: '#a8c8f0',
    strokeWidth: 2,
    padding: 120,
  },
  'watercolor-wash': {
    name: 'watercolor-wash',
    backgroundColor: '#f5f0e8',
    strokeColor: '#8b6f47',
    strokeWidth: 4,
    padding: 120,
  },
  'bold-graphic': {
    name: 'bold-graphic',
    backgroundColor: '#1a1a1a',
    strokeColor: '#f5c518',
    strokeWidth: 6,
    padding: 120,
  },
};

export function getStylePreset(style: StyleName): StylePreset {
  return presets[style];
}

export function getAllStylePresets(): StylePreset[] {
  return Object.values(presets);
}
