import { describe, expect, it } from 'vitest';
import { getOrderDisplayNumber } from '@/lib/order-number';

describe('getOrderDisplayNumber', () => {
  it('usa el número de la secuencia cuando existe', () => {
    expect(getOrderDisplayNumber({ id: 'ORD-MEX123-AB12CD', displayNumber: 42 })).toBe(42);
  });

  it('conserva el número de los ORD-0001 históricos sin displayNumber', () => {
    expect(getOrderDisplayNumber({ id: 'ORD-0007' })).toBe(7);
  });

  it('deriva un número estable de 3 cifras para IDs históricos sin backfill', () => {
    const order = { id: 'ORD-MEX123-AB12CD' };
    const first = getOrderDisplayNumber(order);
    expect(first).toBeGreaterThanOrEqual(100);
    expect(first).toBeLessThanOrEqual(999);
    expect(getOrderDisplayNumber(order)).toBe(first);
  });

  it('no devuelve 1 para todos los IDs nuevos', () => {
    const numbers = new Set(
      ['ORD-MEX1-AAAAAA', 'ORD-MEX2-BBBBBB', 'ORD-MEX3-CCCCCC'].map((id) =>
        getOrderDisplayNumber({ id }),
      ),
    );
    expect(numbers.size).toBeGreaterThan(1);
  });
});
