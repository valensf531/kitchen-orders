import { describe, expect, it } from 'vitest';
import { validateManualTableStatusChange } from '@/lib/table-status';

describe('validateManualTableStatusChange', () => {
  it('bloquea liberar o dar por pagada con cuenta abierta', () => {
    expect(
      validateManualTableStatusChange({ targetStatus: 'available', hasOpenOrders: true, closeAccount: false }),
    ).toBe('La mesa tiene cuenta abierta. Cobrala en Caja.');
    expect(
      validateManualTableStatusChange({ targetStatus: 'paid', hasOpenOrders: true, closeAccount: false }),
    ).not.toBeNull();
  });

  it('permite ocupar o marcar pago pendiente con cuenta abierta', () => {
    expect(
      validateManualTableStatusChange({ targetStatus: 'occupied', hasOpenOrders: true, closeAccount: false }),
    ).toBeNull();
    expect(
      validateManualTableStatusChange({ targetStatus: 'pending_payment', hasOpenOrders: true, closeAccount: false }),
    ).toBeNull();
  });

  it('permite todo sin cuenta abierta y siempre el cobro', () => {
    for (const targetStatus of ['available', 'occupied', 'pending_payment', 'paid'] as const) {
      expect(validateManualTableStatusChange({ targetStatus, hasOpenOrders: false, closeAccount: false })).toBeNull();
      expect(validateManualTableStatusChange({ targetStatus, hasOpenOrders: true, closeAccount: true })).toBeNull();
    }
  });
});
