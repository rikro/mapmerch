import { PolygonCoords, StyleName, ProductType, ShippingAddress } from '../types.js';

const BASE_URL = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL
  ?? 'http://localhost:3001';

export interface GenerateArtworkResponse {
  draftId: string;
  svg: string;
}

export interface CreateIntentResponse {
  clientSecret: string;
  amount: number;
}

export interface CreateOrderResponse {
  orderId: string;
}

export async function generateArtwork(
  polygon: PolygonCoords,
  style: StyleName,
  sessionToken: string,
): Promise<GenerateArtworkResponse> {
  const res = await fetch(`${BASE_URL}/api/artwork/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygon, style, sessionToken }),
  });
  if (!res.ok) throw new Error('Artwork generation failed');
  return res.json() as Promise<GenerateArtworkResponse>;
}

export async function createPaymentIntent(
  product: ProductType,
  size: string,
): Promise<CreateIntentResponse> {
  const res = await fetch(`${BASE_URL}/api/payments/create-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product, size }),
  });
  if (!res.ok) throw new Error('Failed to create payment intent');
  return res.json() as Promise<CreateIntentResponse>;
}

export async function createOrder(
  draftId: string,
  sessionToken: string,
  product: ProductType,
  size: string,
  shippingAddress: ShippingAddress,
  stripePaymentIntentId: string,
): Promise<CreateOrderResponse> {
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId, sessionToken, product, size, shippingAddress, stripePaymentIntentId }),
  });
  if (!res.ok) throw new Error('Order creation failed');
  return res.json() as Promise<CreateOrderResponse>;
}
