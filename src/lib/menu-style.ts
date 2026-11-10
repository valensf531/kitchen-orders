export type MenuStyle = 'photos' | 'list';

export const DEFAULT_MENU_STYLE: MenuStyle = 'photos';

export function isMenuStyle(value: unknown): value is MenuStyle {
  return value === 'photos' || value === 'list';
}

export function normalizeMenuStyle(value: unknown): MenuStyle {
  return isMenuStyle(value) ? value : DEFAULT_MENU_STYLE;
}
