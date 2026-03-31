export type StyleName =
  | 'minimal-line-art'
  | 'blueprint'
  | 'watercolor-wash'
  | 'bold-graphic';

export type ProductType = 'print' | 'poster' | 'canvas';

export type AppStep = 'draw' | 'customize' | 'checkout' | 'confirmation';

export interface PolygonCoords {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface StyleOption {
  name: StyleName;
  label: string;
  backgroundColor: string;
  strokeColor: string;
}

export interface ProductOption {
  type: ProductType;
  label: string;
  sizes: string[];
  retailPriceCents: Record<string, number>;
}

export interface ShippingAddress {
  name: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  email: string;
}
