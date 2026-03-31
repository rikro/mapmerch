import { Router, Request, Response } from 'express';
import { updateOrderStatusByPrintfulId } from '../services/orderStore.js';
import { Order } from '../types.js';

export const webhooksRouter = Router();

interface PrintfulWebhookPayload {
  type: string;
  data: { order: { id: number; status: string } };
}

const STATUS_MAP: Record<string, Order['status']> = {
  confirmed: 'confirmed',
  fulfilled: 'fulfilled',
  shipped:   'shipped',
  canceled:  'failed',
};

webhooksRouter.post('/printful', (req: Request, res: Response) => {
  const payload = req.body as PrintfulWebhookPayload;
  const mappedStatus = STATUS_MAP[payload.data?.order?.status];
  if (mappedStatus) {
    updateOrderStatusByPrintfulId(String(payload.data.order.id), mappedStatus);
  }
  res.sendStatus(200);
});
