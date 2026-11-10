import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MENU_THEME,
  MENU_THEME_PRESETS,
  getContrastColor,
  isHexColor,
  mixHex,
  normalizeMenuTheme,
  readCustomMenuTheme,
  readMenuTheme,
  sameMenuTheme,
  themeStyle,
} from '@/lib/menu-theme';

describe('isHexColor', () => {
  it('acepta colores hex de 6 dígitos', () => {
    expect(isHexColor('#0f766e')).toBe(true);
    expect(isHexColor('#FFFFFF')).toBe(true);
    expect(isHexColor('#abc')).toBe(false);
    expect(isHexColor('teal')).toBe(false);
  });
});

describe('normalizeMenuTheme', () => {
  it('mantiene los colores válidos y completa los faltantes', () => {
    const theme = normalizeMenuTheme({ primary: '#123456', accent: '#ABCDEF' });
    expect(theme.primary).toBe('#123456');
    expect(theme.accent).toBe('#abcdef');
    expect(theme.background).toBe(DEFAULT_MENU_THEME.background);
  });

  it('cae a los valores por defecto con datos inválidos', () => {
    expect(normalizeMenuTheme(null)).toEqual(DEFAULT_MENU_THEME);
    expect(normalizeMenuTheme({ primary: 'rojo' }).primary).toBe(
      DEFAULT_MENU_THEME.primary,
    );
  });
});

describe('readMenuTheme', () => {
  it('acepta temas parciales válidos', () => {
    expect(readMenuTheme({ primary: '#112233' })).toMatchObject({
      primary: '#112233',
      accent: DEFAULT_MENU_THEME.accent,
    });
  });

  it('rechaza colores inválidos', () => {
    expect(readMenuTheme({ primary: '#123' })).toBeNull();
    expect(readMenuTheme({ accent: 'naranja' })).toBeNull();
    expect(readMenuTheme(null)).toBeNull();
  });
});

describe('readCustomMenuTheme', () => {
  it('acepta un nombre y una paleta válida', () => {
    const custom = readCustomMenuTheme({
      name: 'Mi cafetería',
      theme: { primary: '#123456' },
    });
    expect(custom?.name).toBe('Mi cafetería');
    expect(custom?.theme.primary).toBe('#123456');
  });

  it('rechaza temas sin nombre o con colores inválidos', () => {
    expect(readCustomMenuTheme({ name: '   ', theme: DEFAULT_MENU_THEME })).toBeNull();
    expect(readCustomMenuTheme({ name: 'Tema', theme: { primary: 'rojo' } })).toBeNull();
    expect(readCustomMenuTheme(null)).toBeNull();
  });
});

describe('sameMenuTheme', () => {
  it('compara todos los colores', () => {
    expect(sameMenuTheme(DEFAULT_MENU_THEME, { ...DEFAULT_MENU_THEME })).toBe(true);
    expect(
      sameMenuTheme(DEFAULT_MENU_THEME, {
        ...DEFAULT_MENU_THEME,
        primary: '#000000',
      }),
    ).toBe(false);
  });
});

describe('color helpers', () => {
  it('mezcla colores', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('elige texto claro u oscuro según el contraste', () => {
    expect(getContrastColor('#0f766e')).toBe('#ffffff');
    expect(getContrastColor('#f59e0b')).toBe('#111827');
  });

  it('genera variables CSS para el tema', () => {
    const style = themeStyle(DEFAULT_MENU_THEME);
    expect(style['--menu-primary' as keyof typeof style]).toBe(DEFAULT_MENU_THEME.primary);
    expect(style['--menu-on-primary' as keyof typeof style]).toBe('#ffffff');
  });
});

describe('presets', () => {
  it('todos los presets tienen colores válidos', () => {
    for (const preset of MENU_THEME_PRESETS) {
      expect(readMenuTheme(preset.theme)).not.toBeNull();
    }
  });
});
