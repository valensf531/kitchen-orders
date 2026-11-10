import { paymentStore } from '@/lib/payment-store';
import { orderStore } from '@/lib/store';
import { freeTableIfEmpty } from '@/lib/order-ops';
import { revalidateStats } from '@/lib/stats-cache';
import { cashSessionStore } from '@/lib/cash-session-store';
import {
  normalizeMercadoPagoStatus,
  type MercadoPagoPayment,
} from '@/lib/mercadopago';
import type { Payment } from '@/types/payment';

/* Idempotente: webhook y polling pueden llegar varias veces. */
async function settleApprovedPayment(payment: Payment) {
  const order = await orderStore.getById(payment.orderId, payment.userId);
  if (!order || order.status === 'canceled' || order.paidAt) return;

  /* Si hay un turno de caja abierto, se imputa ahí para conciliación;
     no suma al efectivo esperado (el arqueo usa solo cashTotal). */
  const session = await cashSessionStore.getOpen(payment.userId).catch(() => null);

  const paid = await orderStore.markOrderPaid(order.id, order.userId, {
    paymentMethod: 'mercadopago',
    paidBy: 'mercadopago',
    paidByName: 'Mercado Pago',
    cashSessionId: session?.id ?? null,
    paidAt: payment.paidAt ?? new Date().toISOString(),
  });
  if (!paid) return;

  await freeTableIfEmpty(paid.userId, {
    id: paid.tableId,
    number: paid.tableNumber,
    zone: paid.zone ?? null,
  });
  revalidateStats(paid.userId);
}

export async function applyMercadoPagoPayment(
  mpPayment: MercadoPagoPayment,
): Promise<Payment | undefined> {
  const externalReference =
    typeof mpPayment.external_reference === 'string' ? mpPayment.external_reference : '';
  if (!externalReference) return undefined;

  const payment = await paymentStore.getById(externalReference);
  if (!payment) return undefined;

  const status = normalizeMercadoPagoStatus(mpPayment.status);
  const updated = await paymentStore.update(payment.id, {
    status,
    statusDetail: mpPayment.status_detail ?? null,
    mpPaymentId: mpPayment.id != null ? String(mpPayment.id) : undefined,
    method: mpPayment.payment_method_id ?? mpPayment.payment_type_id ?? null,
    paidAt: status === 'approved' ? (mpPayment.date_approved ?? new Date().toISOString()) : null,
    raw: mpPayment,
  });
  if (!updated) return undefined;

  if (status === 'approved') {
    await settleApprovedPayment(updated);
  }
  return updated;
}
