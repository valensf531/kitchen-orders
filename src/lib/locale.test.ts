import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMEZONE,
  formatMoney,
  isValidTimezone,
  normalizeCurrencyCode,
  normalizeCurrencySymbol,
} from '@/lib/locale';

describe('locale', () => {
  it('valida zonas horarias reales', () => {
    expect(isValidTimezone(DEFAULT_TIMEZONE)).toBe(true);
    expect(isValidTimezone('Europe/Madrid')).toBe(true);
    expect(isValidTimezone('No/Existe')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });

  it('normaliza moneda y símbolo', () => {
    expect(normalizeCurrencyCode('ars')).toBe('ARS');
    expect(normalizeCurrencyCode('dolar')).toBeNull();
    expect(normalizeCurrencySymbol(' € ')).toBe('€');
    expect(normalizeCurrencySymbol('')).toBeNull();
    expect(normalizeCurrencySymbol('123456')).toBeNull();
  });

  it('formatea montos con el símbolo configurado', () => {
    expect(formatMoney(12.5, '€')).toBe('€12.50');
    expect(formatMoney(0)).toBe('$0.00');
  });
});
