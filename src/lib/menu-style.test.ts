import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MENU_STYLE,
  isMenuStyle,
  normalizeMenuStyle,
} from '@/lib/menu-style';

describe('isMenuStyle', () => {
  it('acepta solo los estilos conocidos', () => {
    expect(isMenuStyle('photos')).toBe(true);
    expect(isMenuStyle('list')).toBe(true);
    expect(isMenuStyle('grid')).toBe(false);
    expect(isMenuStyle(undefined)).toBe(false);
  });
});

describe('normalizeMenuStyle', () => {
  it('mantiene los estilos válidos', () => {
    expect(normalizeMenuStyle('photos')).toBe('photos');
    expect(normalizeMenuStyle('list')).toBe('list');
  });

  it('cae al estilo con fotos para valores inválidos', () => {
    expect(normalizeMenuStyle('otro')).toBe(DEFAULT_MENU_STYLE);
    expect(normalizeMenuStyle(null)).toBe(DEFAULT_MENU_STYLE);
    expect(normalizeMenuStyle(undefined)).toBe(DEFAULT_MENU_STYLE);
  });
});
