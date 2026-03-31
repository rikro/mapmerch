import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import { PolygonCoords } from '../types.js';
import { MAX_POLYGON_AREA_SQ_DEG } from '../constants.js';

interface Props {
  onPolygonComplete: (polygon: PolygonCoords) => void;
  onAreaTooLarge: () => void;
}

function computeApproxAreaSqDeg(latlngs: L.LatLng[]): number {
  // Shoelace formula on lat/lng (approximate, sufficient for area check)
  let area = 0;
  for (let i = 0; i < latlngs.length; i++) {
    const j = (i + 1) % latlngs.length;
    area += latlngs[i].lng * latlngs[j].lat;
    area -= latlngs[j].lng * latlngs[i].lat;
  }
  return Math.abs(area) / 2;
}

export default function MapView({ onPolygonComplete, onAreaTooLarge }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // Refs so the map event handler always calls the latest callbacks
  // without needing to re-initialize the map when they change.
  const onPolygonCompleteRef = useRef(onPolygonComplete);
  const onAreaTooLargeRef = useRef(onAreaTooLarge);

  useEffect(() => { onPolygonCompleteRef.current = onPolygonComplete; }, [onPolygonComplete]);
  useEffect(() => { onAreaTooLargeRef.current = onAreaTooLarge; }, [onAreaTooLarge]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([41.8781, -87.6298], 14);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new (L as unknown as { Control: { Draw: new (opts: unknown) => L.Control } }).Control.Draw({
      draw: {
        polygon: { showArea: true },
        polyline: false,
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
      },
      edit: { featureGroup: drawnItems },
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e: unknown) => {
      const event = e as { layer: L.Polygon };
      drawnItems.clearLayers();
      drawnItems.addLayer(event.layer);

      const latlngs = (event.layer.getLatLngs()[0] as L.LatLng[]);
      const area = computeApproxAreaSqDeg(latlngs);

      if (area > MAX_POLYGON_AREA_SQ_DEG) {
        drawnItems.clearLayers();
        onAreaTooLargeRef.current();
        return;
      }

      const coords = latlngs.map(ll => [ll.lng, ll.lat] as [number, number]);
      coords.push(coords[0]); // close ring
      onPolygonCompleteRef.current({ type: 'Polygon', coordinates: [coords] });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // map initializes once — callbacks are accessed via refs

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100vh' }}
      data-testid="map-view"
    />
  );
}
