import type { PaymentMethod } from '@/types/order';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'card', 'transfer', 'other'];

/* Todos los medios válidos, incluido el cobro online automático. */
const ALL_PAYMENT_METHODS: PaymentMethod[] = [...PAYMENT_METHODS, 'mercadopago'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
  mercadopago: 'Mercado Pago',
};

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (ALL_PAYMENT_METHODS as string[]).includes(value);
}

export function normalizePaymentMethod(value: unknown): PaymentMethod {
  return isPaymentMethod(value) ? value : 'cash';
}
