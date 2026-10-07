import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* El rate limit guarda estado en memoria: cada test importa un módulo fresco. */
describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('permite hasta el límite y bloquea después', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('mesa-1', 3, 60_000)).toBe(true);
    }
    expect(rateLimit('mesa-1', 3, 60_000)).toBe(false);
  });

  it('las claves son independientes', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    expect(rateLimit('mesa-1', 1, 60_000)).toBe(true);
    expect(rateLimit('mesa-1', 1, 60_000)).toBe(false);
    expect(rateLimit('mesa-2', 1, 60_000)).toBe(true);
  });

  it('reinicia al vencer la ventana', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    expect(rateLimit('mesa-1', 1, 60_000)).toBe(true);
    expect(rateLimit('mesa-1', 1, 60_000)).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(rateLimit('mesa-1', 1, 60_000)).toBe(true);
  });
});
