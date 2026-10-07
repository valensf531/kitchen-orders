import { describe, expect, it } from 'vitest';
import {
  csvNumber,
  formatCurrency,
  formatDuration,
  percentChange,
  rangeForPreset,
  toCsv,
} from '@/lib/stats-format';

describe('formatDuration', () => {
  it('formatea segundos, minutos y horas', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(60)).toBe('1m 0s');
    expect(formatDuration(750)).toBe('12m 30s');
    expect(formatDuration(3900)).toBe('1h 5m');
  });

  it('devuelve — para valores inválidos', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(undefined)).toBe('—');
    expect(formatDuration(-5)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
  });
});

describe('formatCurrency', () => {
  it('formatea con separador de miles argentino', () => {
    expect(formatCurrency(229000)).toBe('$229.000,00');
    expect(formatCurrency(0)).toBe('$0,00');
  });
});

describe('percentChange', () => {
  it('calcula la variación porcentual', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
  });

  it('devuelve null sin base de comparación', () => {
    expect(percentChange(100, 0)).toBeNull();
    expect(percentChange(100, -1)).toBeNull();
    expect(percentChange(Number.NaN, 100)).toBeNull();
  });
});

describe('rangeForPreset', () => {
  const now = new Date(2026, 8, 29, 15, 30); // 29/09/2026 15:30 local

  it('hoy arranca a medianoche', () => {
    const { from, to } = rangeForPreset('today', now);
    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(8);
    expect(from.getDate()).toBe(29);
    expect(from.getHours()).toBe(0);
    expect(to.getTime()).toBe(now.getTime());
  });

  it('7d cubre 7 días incluyendo hoy', () => {
    const { from, to } = rangeForPreset('7d', now);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    expect(Math.round((todayStart.getTime() - from.getTime()) / 86_400_000)).toBe(6);
    expect(to.getTime()).toBe(now.getTime());
  });

  it('este mes arranca el día 1', () => {
    const { from } = rangeForPreset('month', now);
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(8);
  });
});

describe('toCsv / csvNumber', () => {
  it('usa separador ; y escapa comillas y saltos', () => {
    expect(toCsv([['a', 'b'], ['c;d', 'e"fg'], ['con\nsalto', 1]]).split('\n')).toHaveLength(3);
    expect(toCsv([['x"y']])).toBe('"x""y"');
    expect(toCsv([['a;b']])).toBe('"a;b"');
  });

  it('números con coma decimal', () => {
    expect(csvNumber(1234.56)).toBe('1234,56');
    expect(csvNumber(0)).toBe('0,00');
  });
});
