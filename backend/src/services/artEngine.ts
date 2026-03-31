import { GeoJSONFeatureCollection, StyleName, StylePreset } from '../types.js';
import { getStylePreset } from './stylePresets.js';

const CANVAS_SIZE = 2400; // px — 8in at 300dpi, scales to any square product

interface BoundingBox {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

function getBoundingBox(
  features: GeoJSONFeatureCollection['features'],
): BoundingBox {
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const feature of features) {
    for (const [lng, lat] of feature.geometry.coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return { minLng, maxLng, minLat, maxLat };
}

function toSvgCoords(
  lng: number,
  lat: number,
  bbox: BoundingBox,
  padding: number,
): [number, number] {
  const usableSize = CANVAS_SIZE - padding * 2;
  const lngRange = bbox.maxLng - bbox.minLng || 0.001;
  const latRange = bbox.maxLat - bbox.minLat || 0.001;
  const scale = Math.min(usableSize / lngRange, usableSize / latRange);
  const x = padding + (lng - bbox.minLng) * scale;
  const y = padding + (bbox.maxLat - lat) * scale; // Y-axis flip: north is up
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

function renderPaths(
  features: GeoJSONFeatureCollection['features'],
  bbox: BoundingBox,
  preset: StylePreset,
): string {
  return features
    .map(feature => {
      const points = feature.geometry.coordinates
        .map(([lng, lat]) => toSvgCoords(lng, lat, bbox, preset.padding).join(','))
        .join(' ');
      return `  <polyline points="${points}" fill="none" stroke="${preset.strokeColor}" stroke-width="${preset.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('\n');
}

export function generateSvg(
  streetData: GeoJSONFeatureCollection,
  style: StyleName,
): string {
  if (streetData.features.length === 0) {
    throw new Error('No street data to render');
  }
  const preset = getStylePreset(style);
  const bbox = getBoundingBox(streetData.features);
  const paths = renderPaths(streetData.features, bbox, preset);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
  <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="${preset.backgroundColor}"/>
${paths}
</svg>`;
}
