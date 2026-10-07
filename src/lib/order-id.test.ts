import { describe, expect, it } from 'vitest';
import { buildOrderId } from '@/lib/store';

describe('buildOrderId', () => {
  it('genera IDs legibles con prefijo ORD-', () => {
    expect(buildOrderId()).toMatch(/^ORD-[0-9A-Z]+-[0-9A-Z]{6}$/);
  });

  it('no genera duplicados en una tanda', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => buildOrderId()));
    expect(ids.size).toBe(1000);
  });

  it('entra en VARCHAR(50)', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(buildOrderId().length).toBeLessThanOrEqual(50);
    }
  });
});
