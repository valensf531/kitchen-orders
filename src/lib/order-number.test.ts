import { describe, expect, it } from 'vitest';
import { getOrderDisplayNumber } from '@/lib/order-ops';

describe('getOrderDisplayNumber', () => {
  it('conserva el número de los ORD-0001 históricos', () => {
    expect(getOrderDisplayNumber('ORD-0007')).toBe(7);
  });

  it('deriva un número estable de 3 cifras para IDs nuevos', () => {
    const id = 'ORD-MEX123-AB12CD';
    const first = getOrderDisplayNumber(id);
    expect(first).toBeGreaterThanOrEqual(100);
    expect(first).toBeLessThanOrEqual(999);
    expect(getOrderDisplayNumber(id)).toBe(first);
  });

  it('no devuelve 1 para todos los IDs nuevos', () => {
    const numbers = new Set(
      ['ORD-MEX1-AAAAAA', 'ORD-MEX2-BBBBBB', 'ORD-MEX3-CCCCCC'].map(getOrderDisplayNumber),
    );
    expect(numbers.size).toBeGreaterThan(1);
  });
});
