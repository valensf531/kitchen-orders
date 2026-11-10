import { getSql } from '@/lib/db';
import {
  normalizeMenuTheme,
  type CustomMenuTheme,
  type MenuTheme,
} from '@/lib/menu-theme';
import { normalizeMenuStyle, type MenuStyle } from '@/lib/menu-style';

export interface Branding {
  userId: string;
  name: string;
  logoUrl: string | null;
  menuStyle: MenuStyle;
  theme: MenuTheme;
  customTheme: CustomMenuTheme | null;
  timezone: string;
  currencyCode: string;
  currencySymbol: string;
  updatedAt: string;
}

export const MAX_BRANDING_NAME = 80;
/* Tope del logo como data-URL (~500KB de imagen) para no inflar la base. */
export const MAX_LOGO_CHARS = 700_000;

type BrandingRow = {
  user_id: string;
  name: string;
  logo_url: string | null;
  menu_style: string | null;
  theme_primary: string | null;
  theme_accent: string | null;
  theme_background: string | null;
  theme_surface: string | null;
  theme_text: string | null;
  custom_theme_name: string | null;
  custom_theme_primary: string | null;
  custom_theme_accent: string | null;
  custom_theme_background: string | null;
  custom_theme_surface: string | null;
  custom_theme_text: string | null;
  timezone: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  updated_at: string;
};

/* Valida nombre y logo. Devuelve mensaje de error o null si está ok. */
export function validateBranding(input: { name?: unknown; logoUrl?: unknown }): string | null {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length > MAX_BRANDING_NAME) {
    return `El nombre no puede superar ${MAX_BRANDING_NAME} caracteres`;
  }
  const logoUrl = input.logoUrl;
  if (logoUrl !== undefined && logoUrl !== null && logoUrl !== '') {
    if (typeof logoUrl !== 'string' || !logoUrl.startsWith('data:image/')) {
      return 'El logo debe ser una imagen';
    }
    if (logoUrl.length > MAX_LOGO_CHARS) {
      return 'El logo es demasiado grande (máx. ~500KB)';
    }
  }
  return null;
}

function mapRow(row: BrandingRow): Branding {
  const customThemeName = row.custom_theme_name?.trim() ?? '';

  return {
    userId: row.user_id,
    name: row.name ?? '',
    logoUrl: row.logo_url ?? null,
    menuStyle: normalizeMenuStyle(row.menu_style),
    theme: normalizeMenuTheme({
      primary: row.theme_primary,
      accent: row.theme_accent,
      background: row.theme_background,
      surface: row.theme_surface,
      text: row.theme_text,
    }),
    customTheme: customThemeName
      ? {
          name: customThemeName,
          theme: normalizeMenuTheme({
            primary: row.custom_theme_primary,
            accent: row.custom_theme_accent,
            background: row.custom_theme_background,
            surface: row.custom_theme_surface,
            text: row.custom_theme_text,
          }),
        }
      : null,
    timezone: row.timezone || 'America/Argentina/Buenos_Aires',
    currencyCode: row.currency_code || 'ARS',
    currencySymbol: row.currency_symbol || '$',
    updatedAt: row.updated_at,
  };
}

class BrandingStore {
  private settingsColumnsReady: Promise<void> | null = null;

  /* Compatibilidad con bases anteriores: preferir `npm run migrate`.
     Desactivable con SKIP_AUTO_SCHEMA=1. Cacheado por proceso. */
  private async ensureSettingsColumns() {
    if (process.env.SKIP_AUTO_SCHEMA === '1') return;
    if (!this.settingsColumnsReady) {
      this.settingsColumnsReady = (async () => {
        const sql = getSql();
        await sql`
          ALTER TABLE restaurant_settings
            ADD COLUMN IF NOT EXISTS menu_style TEXT NOT NULL DEFAULT 'photos',
            ADD COLUMN IF NOT EXISTS theme_primary TEXT NOT NULL DEFAULT '#0f766e',
            ADD COLUMN IF NOT EXISTS theme_accent TEXT NOT NULL DEFAULT '#f59e0b',
            ADD COLUMN IF NOT EXISTS theme_background TEXT NOT NULL DEFAULT '#fffbf7',
            ADD COLUMN IF NOT EXISTS theme_surface TEXT NOT NULL DEFAULT '#ffffff',
            ADD COLUMN IF NOT EXISTS theme_text TEXT NOT NULL DEFAULT '#1c1917',
            ADD COLUMN IF NOT EXISTS custom_theme_name TEXT NOT NULL DEFAULT '',
            ADD COLUMN IF NOT EXISTS custom_theme_primary TEXT NOT NULL DEFAULT '#0f766e',
            ADD COLUMN IF NOT EXISTS custom_theme_accent TEXT NOT NULL DEFAULT '#f59e0b',
            ADD COLUMN IF NOT EXISTS custom_theme_background TEXT NOT NULL DEFAULT '#fffbf7',
            ADD COLUMN IF NOT EXISTS custom_theme_surface TEXT NOT NULL DEFAULT '#ffffff',
            ADD COLUMN IF NOT EXISTS custom_theme_text TEXT NOT NULL DEFAULT '#1c1917',
            ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
            ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'ARS',
            ADD COLUMN IF NOT EXISTS currency_symbol TEXT NOT NULL DEFAULT '$'
        `;
      })().catch((error) => {
        this.settingsColumnsReady = null;
        throw error;
      });
    }
    await this.settingsColumnsReady;
  }

  async getByUserId(userId: string): Promise<Branding | null> {
    const sql = getSql();
    await this.ensureSettingsColumns();
    const rows = await sql`
      SELECT user_id, name, logo_url, menu_style,
             theme_primary, theme_accent, theme_background, theme_surface, theme_text,
             custom_theme_name, custom_theme_primary, custom_theme_accent,
             custom_theme_background, custom_theme_surface, custom_theme_text,
             timezone, currency_code, currency_symbol,
             updated_at
      FROM restaurant_settings WHERE user_id = ${userId} LIMIT 1
    `;
    if (rows.length === 0) return null;
    return mapRow(rows[0] as BrandingRow);
  }

  async upsert(
    userId: string,
    input: {
      name: string;
      logoUrl: string | null;
      menuStyle: MenuStyle;
      theme: MenuTheme;
      customTheme: CustomMenuTheme | null;
      timezone: string;
      currencyCode: string;
      currencySymbol: string;
    },
  ): Promise<Branding> {
    const sql = getSql();
    await this.ensureSettingsColumns();
    const now = new Date().toISOString();
    const customTheme = input.customTheme?.theme;
    await sql`
      INSERT INTO restaurant_settings (
        user_id, name, logo_url, menu_style,
        theme_primary, theme_accent, theme_background, theme_surface, theme_text,
        custom_theme_name, custom_theme_primary, custom_theme_accent,
        custom_theme_background, custom_theme_surface, custom_theme_text,
        timezone, currency_code, currency_symbol,
        created_at, updated_at
      )
      VALUES (
        ${userId}, ${input.name}, ${input.logoUrl}, ${input.menuStyle},
        ${input.theme.primary}, ${input.theme.accent}, ${input.theme.background},
        ${input.theme.surface}, ${input.theme.text},
        ${input.customTheme?.name ?? ''},
        ${customTheme?.primary ?? input.theme.primary},
        ${customTheme?.accent ?? input.theme.accent},
        ${customTheme?.background ?? input.theme.background},
        ${customTheme?.surface ?? input.theme.surface},
        ${customTheme?.text ?? input.theme.text},
        ${input.timezone}, ${input.currencyCode}, ${input.currencySymbol},
        ${now}, ${now}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        logo_url = EXCLUDED.logo_url,
        menu_style = EXCLUDED.menu_style,
        theme_primary = EXCLUDED.theme_primary,
        theme_accent = EXCLUDED.theme_accent,
        theme_background = EXCLUDED.theme_background,
        theme_surface = EXCLUDED.theme_surface,
        theme_text = EXCLUDED.theme_text,
        custom_theme_name = EXCLUDED.custom_theme_name,
        custom_theme_primary = EXCLUDED.custom_theme_primary,
        custom_theme_accent = EXCLUDED.custom_theme_accent,
        custom_theme_background = EXCLUDED.custom_theme_background,
        custom_theme_surface = EXCLUDED.custom_theme_surface,
        custom_theme_text = EXCLUDED.custom_theme_text,
        timezone = EXCLUDED.timezone,
        currency_code = EXCLUDED.currency_code,
        currency_symbol = EXCLUDED.currency_symbol,
        updated_at = EXCLUDED.updated_at
    `;
    return {
      userId,
      name: input.name,
      logoUrl: input.logoUrl,
      menuStyle: input.menuStyle,
      theme: input.theme,
      customTheme: input.customTheme,
      timezone: input.timezone,
      currencyCode: input.currencyCode,
      currencySymbol: input.currencySymbol,
      updatedAt: now,
    };
  }
}

export const brandingStore = new BrandingStore();
