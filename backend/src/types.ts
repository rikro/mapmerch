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
