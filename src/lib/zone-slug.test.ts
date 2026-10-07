import { describe, expect, it } from 'vitest';
import { toZoneSlug } from '@/lib/zone-store';

describe('toZoneSlug', () => {
  it('normaliza nombre a slug', () => {
    expect(toZoneSlug('Terraza VIP')).toBe('terraza_vip');
    expect(toZoneSlug('Salón Ñoño!')).toBe('salon_nono');
  });

  it('nombres similares colisionan en el mismo slug', () => {
    /* Por eso borrar una zona debe borrar sus mesas en cascada: si no,
       al recrear un nombre similar las mesas huérfanas "reaparecen". */
    expect(toZoneSlug('Terraza')).toBe(toZoneSlug('terraza'));
    expect(toZoneSlug('Terraza')).toBe(toZoneSlug('Terraza!'));
  });
});
