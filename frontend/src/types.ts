export type StyleName =
  | 'minimal-line-art'
  | 'blueprint'
  | 'watercolor-wash'
  | 'bold-graphic';

export type ProductType = 'print' | 'poster' | 'canvas';

export type AppStep = 'home' | 'draw' | 'customize' | 'checkout' | 'confirmation';

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

export interface TypographyConfig {
  typeface: string;
  size: number;
  weight: string;
  color: string;
  baselineOffset?: number; // px lift above the street line via CSS translateY; only used for street labels
}

export type CoordPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type CoordFormat = 'Decimal Degrees' | 'DMS';

export interface CoordsConfig {
  show: boolean;
  format: CoordFormat;
  position: CoordPosition;
  opacity: number;
}

export type SymbolIcon = 'heart' | 'star' | 'pin' | 'zap';

export interface SymbolConfig {
  show: boolean;
  icon: SymbolIcon;
  scale: number;
  color: string;
  opacity: number;
}

export type StreetGroupId = 'major' | 'secondary' | 'local' | 'pedestrian' | 'cycling' | 'service';
export type DashStyle = 'solid' | 'dashed' | 'dotted';

export interface StreetGroupStyle {
  strokeWidth: number;
  dashStyle: DashStyle;
  color: string | null; // null = follow theme (no CSS color override)
}

export interface StreetConfig {
  enabledGroups: StreetGroupId[];
  groupStyles: Record<StreetGroupId, StreetGroupStyle>;
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
