import type { CSSProperties } from 'react';

export interface MenuTheme {
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

export interface CustomMenuTheme {
  name: string;
  theme: MenuTheme;
}

export const MAX_CUSTOM_THEME_NAME = 40;

export const THEME_KEYS = ['primary', 'accent', 'background', 'surface', 'text'] as const;

export const DEFAULT_MENU_THEME: MenuTheme = {
  primary: '#0f766e',
  accent: '#f59e0b',
  background: '#fffbf7',
  surface: '#ffffff',
  text: '#1c1917',
};

export const MENU_THEME_PRESETS: {
  id: string;
  name: string;
  description: string;
  theme: MenuTheme;
}[] = [
  {
    id: 'lumen',
    name: 'Lumen',
    description: 'Verde y ámbar cálido',
    theme: DEFAULT_MENU_THEME,
  },
  {
    id: 'cafe',
    name: 'Café',
    description: 'Espresso y caramelo',
    theme: {
      primary: '#7c2d12',
      accent: '#f59e0b',
      background: '#f7efe4',
      surface: '#fffaf3',
      text: '#241a12',
    },
  },
  {
    id: 'matcha',
    name: 'Matcha',
    description: 'Verde oliva y crema',
    theme: {
      primary: '#3f6212',
      accent: '#d97706',
      background: '#f4f6ed',
      surface: '#ffffff',
      text: '#1f2a17',
    },
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'Grafito y cobre',
    theme: {
      primary: '#1c1917',
      accent: '#f97316',
      background: '#f5f2ed',
      surface: '#ffffff',
      text: '#171412',
    },
  },
  {
    id: 'ocean',
    name: 'Océano',
    description: 'Azul profundo y menta',
    theme: {
      primary: '#0e7490',
      accent: '#14b8a6',
      background: '#f0f9ff',
      surface: '#ffffff',
      text: '#0f172a',
    },
  },
];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/* Normaliza un tema guardado o parcial, cayendo a los valores por defecto. */
export function normalizeMenuTheme(value: unknown): MenuTheme {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    primary: isHexColor(record.primary)
      ? record.primary.toLowerCase()
      : DEFAULT_MENU_THEME.primary,
    accent: isHexColor(record.accent)
      ? record.accent.toLowerCase()
      : DEFAULT_MENU_THEME.accent,
    background: isHexColor(record.background)
      ? record.background.toLowerCase()
      : DEFAULT_MENU_THEME.background,
    surface: isHexColor(record.surface)
      ? record.surface.toLowerCase()
      : DEFAULT_MENU_THEME.surface,
    text: isHexColor(record.text)
      ? record.text.toLowerCase()
      : DEFAULT_MENU_THEME.text,
  };
}

/* Valida un tema recibido por API: cada color presente debe ser hex válido.
   Devuelve null si hay algún valor inválido. */
export function readMenuTheme(value: unknown): MenuTheme | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const theme = { ...DEFAULT_MENU_THEME };

  for (const key of THEME_KEYS) {
    const color = record[key];
    if (color === undefined) continue;
    if (!isHexColor(color)) return null;
    theme[key] = color.toLowerCase();
  }

  return theme;
}

/* Valida un tema personalizado con nombre y colores. */
export function readCustomMenuTheme(value: unknown): CustomMenuTheme | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name =
    typeof record.name === 'string'
      ? record.name.trim().slice(0, MAX_CUSTOM_THEME_NAME)
      : '';
  if (!name) return null;
  const theme = readMenuTheme(record.theme);
  if (!theme) return null;
  return { name, theme };
}

export function sameMenuTheme(a: MenuTheme, b: MenuTheme): boolean {
  return THEME_KEYS.every((key) => a[key] === b[key]);
}

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbToHex(red: number, green: number, blue: number): string {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return `#${[red, green, blue]
    .map((channel) => clamp(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

/* Mezcla dos colores: weight = 0 devuelve `a`, weight = 1 devuelve `b`. */
export function mixHex(a: string, b: string, weight: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const ratio = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    ar * (1 - ratio) + br * ratio,
    ag * (1 - ratio) + bg * ratio,
    ab * (1 - ratio) + bb * ratio,
  );
}

/* Blanco o grafito según el contraste del fondo, para texto sobre acentos. */
export function getContrastColor(hex: string): '#ffffff' | '#111827' {
  const [red, green, blue] = hexToRgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#111827';
}

export function themeStyle(theme: MenuTheme): CSSProperties {
  return {
    '--menu-primary': theme.primary,
    '--menu-accent': theme.accent,
    '--menu-bg': theme.background,
    '--menu-surface': theme.surface,
    '--menu-text': theme.text,
    '--menu-on-primary': getContrastColor(theme.primary),
    '--menu-on-accent': getContrastColor(theme.accent),
    '--menu-muted': mixHex(theme.text, theme.background, 0.45),
    '--menu-line': mixHex(theme.text, theme.background, 0.85),
    '--menu-primary-soft': mixHex(theme.primary, theme.surface, 0.88),
    '--menu-accent-soft': mixHex(theme.accent, theme.surface, 0.85),
  } as CSSProperties;
}
