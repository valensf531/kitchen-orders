import { getSql } from '@/lib/db';

export interface Branding {
  userId: string;
  name: string;
  logoUrl: string | null;
  updatedAt: string;
}

export const MAX_BRANDING_NAME = 80;
/* Tope del logo como data-URL (~500KB de imagen) para no inflar la base. */
export const MAX_LOGO_CHARS = 700_000;

type BrandingRow = {
  user_id: string;
  name: string;
  logo_url: string | null;
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
  return {
    userId: row.user_id,
    name: row.name ?? '',
    logoUrl: row.logo_url ?? null,
    updatedAt: row.updated_at,
  };
}

class BrandingStore {
  async getByUserId(userId: string): Promise<Branding | null> {
    const sql = getSql();
    const rows = await sql`
      SELECT user_id, name, logo_url, updated_at
      FROM restaurant_settings WHERE user_id = ${userId} LIMIT 1
    `;
    if (rows.length === 0) return null;
    return mapRow(rows[0] as BrandingRow);
  }

  async upsert(userId: string, input: { name: string; logoUrl: string | null }): Promise<Branding> {
    const sql = getSql();
    const now = new Date().toISOString();
    await sql`
      INSERT INTO restaurant_settings (user_id, name, logo_url, created_at, updated_at)
      VALUES (${userId}, ${input.name}, ${input.logoUrl}, ${now}, ${now})
      ON CONFLICT (user_id)
      DO UPDATE SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url, updated_at = EXCLUDED.updated_at
    `;
    return { userId, name: input.name, logoUrl: input.logoUrl, updatedAt: now };
  }
}

export const brandingStore = new BrandingStore();
