import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { ProductType } from '../types.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const paymentsRouter = Router();

// Retail prices in cents (your markup included)
const PRICES: Record<ProductType, Record<string, number>> = {
  print:  { '8x8': 2500, '12x12': 3500, '16x16': 4500 },
  poster: { '12x18': 3000, '18x24': 4000 },
  canvas: { '8x8': 5500, '12x12': 7500, '16x16': 9500 },
};

paymentsRouter.post('/create-intent', async (req: Request, res: Response) => {
  const { product, size } = req.body as { product: ProductType; size: string };
  const amount = PRICES[product]?.[size];
  if (!amount) return res.status(400).json({ error: 'Invalid product or size' });

  const intent = await stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
  });

  return res.json({ clientSecret: intent.client_secret, amount });
});
