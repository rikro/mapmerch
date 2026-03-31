import { randomUUID } from 'crypto';
import { Order, ProductType, ShippingAddress } from '../types.js';

const store = new Map<string, Order>();

export function createOrder(
  draftId: string,
  printfulOrderId: string,
  product: ProductType,
  size: string,
  shippingAddress: ShippingAddress,
): Order {
  const order: Order = {
    id: randomUUID(),
    draftId,
    printfulOrderId,
    status: 'pending',
    product,
    size,
    shippingAddress,
    createdAt: new Date(),
  };
  store.set(order.id, order);
  return order;
}

export function updateOrderStatusByPrintfulId(
  printfulOrderId: string,
  status: Order['status'],
): void {
  for (const order of store.values()) {
    if (order.printfulOrderId === printfulOrderId) {
      order.status = status;
      return;
    }
  }
}

export function getOrder(orderId: string): Order | null {
  return store.get(orderId) ?? null;
}
