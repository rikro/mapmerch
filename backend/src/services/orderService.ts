import { Draft, Order, ProductType, ShippingAddress } from '../types.js';
import { createOrder } from './orderStore.js';

const PRINTFUL_API_URL = 'https://api.printful.com';

// Printful variant IDs — look these up at https://api.printful.com/products
// after creating your Printful store. These are placeholder values.
const PRODUCT_VARIANTS: Record<ProductType, Record<string, number>> = {
  print:  { '8x8': 1001, '12x12': 1002, '16x16': 1003 },
  poster: { '12x18': 2001, '18x24': 2002 },
  canvas: { '8x8': 3001, '12x12': 3002, '16x16': 3003 },
};

interface PrintfulRecipient {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  zip: string;
  country_code: string;
  email: string;
}

export interface PrintfulOrderPayload {
  external_id: string;
  recipient: PrintfulRecipient;
  items: Array<{
    variant_id: number;
    quantity: number;
    files: Array<{ type: string; url: string }>;
  }>;
}

export function buildPrintfulPayload(
  draft: Draft,
  product: ProductType,
  size: string,
  shippingAddress: ShippingAddress,
  idempotencyKey: string,
  svgDataUrl: string,
): PrintfulOrderPayload {
  const variantId = PRODUCT_VARIANTS[product]?.[size];
  if (!variantId) throw new Error(`Unknown product/size: ${product}/${size}`);

  return {
    external_id: idempotencyKey,
    recipient: {
      name: shippingAddress.name,
      address1: shippingAddress.address1,
      address2: shippingAddress.address2,
      city: shippingAddress.city,
      state_code: shippingAddress.state,
      zip: shippingAddress.zip,
      country_code: shippingAddress.country,
      email: shippingAddress.email,
    },
    items: [
      {
        variant_id: variantId,
        quantity: 1,
        files: [{ type: 'default', url: svgDataUrl }],
      },
    ],
  };
}

export async function createPrintfulOrder(
  draft: Draft,
  product: ProductType,
  size: string,
  shippingAddress: ShippingAddress,
  idempotencyKey: string,
): Promise<Order> {
  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(draft.svg).toString('base64')}`;
  const payload = buildPrintfulPayload(
    draft,
    product,
    size,
    shippingAddress,
    idempotencyKey,
    svgDataUrl,
  );

  const res = await fetch(`${PRINTFUL_API_URL}/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PRINTFUL_API_KEY}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Printful order failed: ${errText}`);
  }

  const data = await res.json() as { result: { id: number } };
  return createOrder(draft.id, String(data.result.id), product, size, shippingAddress);
}
