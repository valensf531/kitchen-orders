import { describe, expect, it } from 'vitest';
import { isPaymentMethod, normalizePaymentMethod } from '@/lib/payments';

describe('payments', () => {
  it('reconoce medios válidos', () => {
    expect(isPaymentMethod('cash')).toBe(true);
    expect(isPaymentMethod('card')).toBe(true);
    expect(isPaymentMethod('transfer')).toBe(true);
    expect(isPaymentMethod('other')).toBe(true);
    expect(isPaymentMethod('mercadopago')).toBe(true);
  });

  it('rechaza valores desconocidos y normaliza a efectivo', () => {
    expect(isPaymentMethod('bitcoin')).toBe(false);
    expect(normalizePaymentMethod('card')).toBe('card');
    expect(normalizePaymentMethod('bitcoin')).toBe('cash');
    expect(normalizePaymentMethod(undefined)).toBe('cash');
  });
});
