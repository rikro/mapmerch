import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getDraft } from '../services/draftStore.js';
import { createPrintfulOrder } from '../services/orderService.js';
import { CreateOrderRequest } from '../types.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const ordersRouter = Router();

ordersRouter.post('/', async (req: Request, res: Response) => {
  const { draftId, sessionToken, product, size, shippingAddress, stripePaymentIntentId } =
    req.body as CreateOrderRequest;

  if (!draftId || !sessionToken || !product || !size || !shippingAddress || !stripePaymentIntentId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const draft = getDraft(draftId, sessionToken);
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found or expired. Please regenerate your artwork.' });
  }

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
  } catch {
    return res.status(400).json({ error: 'Invalid payment intent' });
  }

  if (paymentIntent.status !== 'succeeded') {
    return res.status(402).json({ error: 'Payment not completed' });
  }

  try {
    const idempotencyKey = `${draftId}-${stripePaymentIntentId}`;
    const order = await createPrintfulOrder(draft, product, size, shippingAddress, idempotencyKey);
    return res.json({ orderId: order.id });
  } catch (err) {
    console.error('Order creation error:', err);
    return res.status(500).json({ error: 'Order creation failed. Please contact support.' });
  }
});
