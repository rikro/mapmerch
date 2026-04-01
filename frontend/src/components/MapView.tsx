import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet-draw';
import { AnimatePresence } from 'motion/react';
import { PolygonCoords } from '../types.js';
import { MAX_POLYGON_AREA_SQ_DEG } from '../constants.js';
import DeleteConfirmModal from './DeleteConfirmModal.js';
import LocationSearch from './LocationSearch.js';

interface Props {
  onPolygonComplete: (polygon: PolygonCoords) => void;
  onAreaTooLarge: () => void;
  onShapeCleared?: () => void;
  className?: string;
}

function circleToPolygon(
  center: L.LatLng,
  radiusMeters: number,
  numSides = 64,
): [number, number][] {
  const latRad = (center.lat * Math.PI) / 180;
  const points: [number, number][] = [];
  for (let i = 0; i < numSides; i++) {
    const angle = (i / numSides) * 2 * Math.PI;
    const latOffset = (radiusMeters / 111320) * Math.cos(angle);
    const lngOffset = (radiusMeters / (111320 * Math.cos(latRad))) * Math.sin(angle);
    points.push([center.lng + lngOffset, center.lat + latOffset]);
  }
  points.push(points[0]); // close ring
  return points;
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

export default function MapView({ onPolygonComplete, onAreaTooLarge, onShapeCleared, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  // Refs so the map event handler always calls the latest callbacks
  // without needing to re-initialize the map when they change.
  const onPolygonCompleteRef = useRef(onPolygonComplete);
  const onAreaTooLargeRef = useRef(onAreaTooLarge);
  const onShapeClearedRef = useRef(onShapeCleared);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null);

  useEffect(() => { onPolygonCompleteRef.current = onPolygonComplete; }, [onPolygonComplete]);
  useEffect(() => { onAreaTooLargeRef.current = onAreaTooLarge; }, [onAreaTooLarge]);
  useEffect(() => { onShapeClearedRef.current = onShapeCleared; }, [onShapeCleared]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current).setView([41.2254, -85.0226], 15);
    mapRef.current = map;

    L.tileLayer('https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 20,
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    const drawControl = new (L as unknown as { Control: { Draw: new (opts: unknown) => L.Control } }).Control.Draw({
      draw: {
        polygon:      { showArea: true },
        rectangle:    {},
        circle:       {},
        polyline:     false,
        circlemarker: false,
        marker:       false,
      },
      edit: {
        featureGroup: drawnItems,
        edit:         false,  // disables edit mode — button is hidden via CSS in index.css (.leaflet-draw-edit-edit)
      },
    });
    map.addControl(drawControl);

    // Replace leaflet-draw's rectangle and circle mouse handlers with standard
    // drag interactions. Rectangle: mousedown corner → drag → mouseup corner.
    // Circle: mousedown edge → drag → mouseup, center tracks the midpoint.
    // Both replace _onMouseDown/_onMouseMove/_onMouseUp on the handler instance
    // so addHooks/removeHooks (map dragging, cleanup) still run unmodified.
    const modes = (drawControl as any)?._toolbars?.draw?._modes;

    const rh = modes?.rectangle?.handler;
    if (rh) {
      rh._onMouseDown = function(this: any, e: L.LeafletMouseEvent) {
        this._isDrawing = true;
        this._startLatLng = e.latlng;
        L.DomEvent.on(document, 'mouseup',  this._onMouseUp, this)
                  .on(document, 'touchend', this._onMouseUp, this)
                  .preventDefault(e.originalEvent);
      };
      rh._onMouseMove = function(this: any, e: L.LeafletMouseEvent) {
        if (!this._isDrawing) return;
        const bounds = new L.LatLngBounds(this._startLatLng, e.latlng);
        if (!this._shape) {
          this._shape = new L.Rectangle(bounds, this.options.shapeOptions);
          this._map.addLayer(this._shape);
        } else {
          this._shape.setBounds(bounds);
        }
      };
      rh._onMouseUp = function(this: any) {
        if (!this._isDrawing) return;
        this._isDrawing = false;
        L.DomEvent.off(document, 'mouseup',  this._onMouseUp, this)
                  .off(document, 'touchend', this._onMouseUp, this);
        if (this._shape) this._fireCreatedEvent();
        this.disable();
        if (this.options.repeatMode) this.enable();
      };
    }

    const ch = modes?.circle?.handler;
    if (ch) {
      ch._onMouseDown = function(this: any, e: L.LeafletMouseEvent) {
        this._isDrawing = true;
        this._startLatLng = e.latlng;
        L.DomEvent.on(document, 'mouseup',  this._onMouseUp, this)
                  .on(document, 'touchend', this._onMouseUp, this)
                  .preventDefault(e.originalEvent);
      };
      ch._onMouseMove = function(this: any, e: L.LeafletMouseEvent) {
        if (!this._isDrawing) return;
        const s = this._startLatLng;
        const c = e.latlng;
        const center = L.latLng((s.lat + c.lat) / 2, (s.lng + c.lng) / 2);
        const radius = center.distanceTo(c);
        if (!this._shape) {
          this._shape = new L.Circle(center, radius, this.options.shapeOptions);
          this._map.addLayer(this._shape);
        } else {
          this._shape.setLatLng(center).setRadius(radius);
        }
      };
      ch._onMouseUp = function(this: any) {
        if (!this._isDrawing) return;
        this._isDrawing = false;
        L.DomEvent.off(document, 'mouseup',  this._onMouseUp, this)
                  .off(document, 'touchend', this._onMouseUp, this);
        if (this._shape) this._fireCreatedEvent();
        this.disable();
        if (this.options.repeatMode) this.enable();
      };
      // Built-in _fireCreatedEvent uses _startLatLng as center; use shape's
      // actual midpoint instead.
      ch._fireCreatedEvent = function(this: any) {
        const circle = new L.Circle(
          this._shape.getLatLng(),
          this._shape.getRadius(),
          this.options.shapeOptions,
        );
        this._map.fire(L.Draw.Event.CREATED, { layer: circle, layerType: this.type });
      };
    }

    const trashBtn = containerRef.current?.querySelector(
      '.leaflet-draw-edit-remove',
    ) as HTMLElement | null;

    // Store handler reference for cleanup
    const trashClickHandler = (e: MouseEvent) => {
      e.stopImmediatePropagation();
      if (drawnItemsRef.current && drawnItemsRef.current.getLayers().length > 0) {
        setShowDeleteModal(true);
      }
    };

    if (trashBtn) {
      trashBtn.addEventListener(
        'click',
        trashClickHandler,
        true, // capture phase — fires before leaflet-draw's own listener
      );
    }

    map.on(L.Draw.Event.CREATED, (e: unknown) => {
      const event = e as { layerType: string; layer: L.Layer };
      drawnItems.clearLayers();
      drawnItems.addLayer(event.layer);

      let coords: [number, number][];

      if (event.layerType === 'circle') {
        const circle = event.layer as L.Circle;
        coords = circleToPolygon(circle.getLatLng(), circle.getRadius());
      } else {
        // polygon and rectangle both expose getLatLngs()
        const poly = event.layer as L.Polygon;
        const latlngs = poly.getLatLngs()[0] as L.LatLng[];
        const area = computeApproxAreaSqDeg(latlngs);
        if (area > MAX_POLYGON_AREA_SQ_DEG) {
          drawnItems.clearLayers();
          onAreaTooLargeRef.current();
          return;
        }
        coords = latlngs.map(ll => [ll.lng, ll.lat] as [number, number]);
        coords.push(coords[0]); // close ring
      }

      onPolygonCompleteRef.current({ type: 'Polygon', coordinates: [coords] });
    });

    return () => {
      if (trashBtn) {
        trashBtn.removeEventListener('click', trashClickHandler, true);
      }
      drawnItemsRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []); // map initializes once — callbacks are accessed via refs

  const handleDeleteConfirm = () => {
    drawnItemsRef.current?.clearLayers();
    onShapeClearedRef.current?.();
    setShowDeleteModal(false);
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };

  return (
    <div
      className={className}
      style={!className ? { width: '100%', height: '100vh', position: 'relative' } : undefined}
      data-testid="map-view"
    >
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0 }}
      />
      <LocationSearch mapRef={mapRef} />
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteConfirmModal
            onConfirm={handleDeleteConfirm}
            onCancel={handleDeleteCancel}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
