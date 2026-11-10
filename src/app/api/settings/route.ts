import { NextRequest, NextResponse } from 'next/server';
import { brandingStore, validateBranding, MAX_BRANDING_NAME } from '@/lib/branding-store';
import {
  DEFAULT_MENU_THEME,
  readCustomMenuTheme,
  readMenuTheme,
} from '@/lib/menu-theme';
import { DEFAULT_MENU_STYLE, isMenuStyle } from '@/lib/menu-style';
import { requireAccess, requireAdmin } from '@/lib/access';
import { revalidatePublicMenu } from '@/lib/menu-cache';
import { revalidateStats } from '@/lib/stats-cache';
import {
  DEFAULT_CURRENCY_CODE,
  DEFAULT_CURRENCY_SYMBOL,
  DEFAULT_TIMEZONE,
  isValidTimezone,
  normalizeCurrencyCode,
  normalizeCurrencySymbol,
} from '@/lib/locale';
import { logError } from '@/lib/log';

/* Marca del restaurante (nombre + logo para tarjetas QR y menú público).
   GET lo leen admin y vendedor; PUT solo admin. */
export async function GET() {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const branding = await brandingStore.getByUserId(access.restaurantId);
    return NextResponse.json({
      restaurantId: access.restaurantId,
      isAdmin: access.isAdmin,
      /* URL pública real del contenedor (runtime), para generar QR correctos. */
      publicBaseUrl:
        process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || '',
      branding: branding ?? {
        userId: access.restaurantId,
        name: '',
        logoUrl: null,
        menuStyle: DEFAULT_MENU_STYLE,
        theme: DEFAULT_MENU_THEME,
        customTheme: null,
        timezone: DEFAULT_TIMEZONE,
        currencyCode: DEFAULT_CURRENCY_CODE,
        currencySymbol: DEFAULT_CURRENCY_SYMBOL,
        updatedAt: null,
      },
    });
  } catch (error) {
    logError('settings.GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const existing = await brandingStore.getByUserId(admin.restaurantId);
    const name =
      typeof body.name === 'string'
        ? body.name.trim().slice(0, MAX_BRANDING_NAME)
        : existing?.name ?? '';
    const logoUrl =
      body.logoUrl === undefined
        ? existing?.logoUrl ?? null
        : body.logoUrl === null || body.logoUrl === ''
          ? null
          : String(body.logoUrl);

    let menuStyle = existing?.menuStyle ?? DEFAULT_MENU_STYLE;
    if (body.menuStyle !== undefined) {
      if (!isMenuStyle(body.menuStyle)) {
        return NextResponse.json({ error: 'Estilo de menú inválido' }, { status: 400 });
      }
      menuStyle = body.menuStyle;
    }

    let theme = existing?.theme ?? DEFAULT_MENU_THEME;
    if (body.theme !== undefined) {
      const parsedTheme = readMenuTheme(body.theme);
      if (!parsedTheme) {
        return NextResponse.json({ error: 'Tema de menú inválido' }, { status: 400 });
      }
      theme = parsedTheme;
    }

    let customTheme = existing?.customTheme ?? null;
    if (body.customTheme === null) {
      customTheme = null;
    } else if (body.customTheme !== undefined) {
      const parsedCustomTheme = readCustomMenuTheme(body.customTheme);
      if (!parsedCustomTheme) {
        return NextResponse.json(
          { error: 'Tema personalizado inválido' },
          { status: 400 },
        );
      }
      customTheme = parsedCustomTheme;
    }

    const timezone =
      body.timezone === undefined ? existing?.timezone ?? DEFAULT_TIMEZONE : body.timezone;
    if (!isValidTimezone(timezone)) {
      return NextResponse.json({ error: 'Zona horaria inválida' }, { status: 400 });
    }

    const currencyCode =
      body.currencyCode === undefined
        ? existing?.currencyCode ?? DEFAULT_CURRENCY_CODE
        : normalizeCurrencyCode(body.currencyCode);
    if (!currencyCode) {
      return NextResponse.json({ error: 'Código de moneda inválido' }, { status: 400 });
    }

    const currencySymbol =
      body.currencySymbol === undefined
        ? existing?.currencySymbol ?? DEFAULT_CURRENCY_SYMBOL
        : normalizeCurrencySymbol(body.currencySymbol);
    if (!currencySymbol) {
      return NextResponse.json({ error: 'Símbolo de moneda inválido' }, { status: 400 });
    }

    const fieldError = validateBranding({ name, logoUrl });
    if (fieldError) {
      return NextResponse.json({ error: fieldError }, { status: 400 });
    }

    const branding = await brandingStore.upsert(admin.restaurantId, {
      name,
      logoUrl,
      menuStyle,
      theme,
      customTheme,
      timezone,
      currencyCode,
      currencySymbol,
    });
    revalidatePublicMenu(admin.restaurantId);
    revalidateStats(admin.restaurantId);
    return NextResponse.json({ branding });
  } catch (error) {
    logError('settings.PUT', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
