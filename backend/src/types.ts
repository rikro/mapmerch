export type GeoJSONPosition = [number, number]; // [lng, lat]

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: GeoJSONPosition[][];
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: GeoJSONPosition[];
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: GeoJSONLineString;
  properties: Record<string, unknown>;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export type StyleName =
  | 'minimal-line-art'
  | 'blueprint'
  | 'watercolor-wash'
  | 'bold-graphic';

export interface StylePreset {
  name: StyleName;
  backgroundColor: string;
  strokeColor: string;
  strokeWidth: number;
  padding: number;
}

export interface Draft {
  id: string;
  sessionToken: string;
  polygon: GeoJSONPolygon;
  style: StyleName;
  svg: string;
  createdAt: Date;
}

export type ProductType = 'print' | 'poster' | 'canvas';

export interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  email: string;
}

export interface Order {
  id: string;
  draftId: string;
  printfulOrderId: string;
  status: 'pending' | 'confirmed' | 'fulfilled' | 'shipped' | 'failed';
  product: ProductType;
  size: string;
  shippingAddress: ShippingAddress;
  createdAt: Date;
}

export interface GenerateArtworkRequest {
  polygon: GeoJSONPolygon;
  style: StyleName;
  sessionToken: string;
  highwayTypes?: string[]; // OSM highway tag values to include; omit = all
  labelOffset?: number;   // perpendicular offset of label path from street line in SVG px
  groupMap?: Record<string, string>; // OSM highway type → group ID, e.g. { motorway: 'major' }
  clipToBoundary?: boolean; // when false, omit clipPath and land/water-bg layers (default true)
}

export interface GenerateArtworkResponse {
  draftId: string;
  svg: string;
}

export interface CreateOrderRequest {
  draftId: string;
  sessionToken: string;
  product: ProductType;
  size: string;
  shippingAddress: ShippingAddress;
  stripePaymentIntentId: string;
}

// A single closed ring of [lng, lat] coordinate pairs describing a water body outline.
export type WaterRing = [number, number][];

// A single closed ring of [lng, lat] coordinate pairs describing a land mass outline.
export type LandRing = [number, number][];
