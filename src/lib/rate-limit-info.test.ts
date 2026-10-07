import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* checkRateLimit informa remaining y reset para cabeceras 429 correctas. */
describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('informa remaining decreciente y bloquea al superar el límite', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit');
    expect(checkRateLimit('k', 2, 60_000)).toMatchObject({ allowed: true, remaining: 1 });
    expect(checkRateLimit('k', 2, 60_000)).toMatchObject({ allowed: true, remaining: 0 });
    const blocked = checkRateLimit('k', 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAfterMs).toBeGreaterThan(0);
    expect(blocked.resetAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('rateLimit sigue siendo wrapper booleano compatible', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    expect(rateLimit('w', 1, 60_000)).toBe(true);
    expect(rateLimit('w', 1, 60_000)).toBe(false);
  });
});
