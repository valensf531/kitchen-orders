import type { PaymentMethod } from '@/types/order';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'other'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as string[]).includes(value);
}

export function normalizePaymentMethod(value: unknown): PaymentMethod {
  return isPaymentMethod(value) ? value : 'cash';
}
