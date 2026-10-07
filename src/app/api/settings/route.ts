import { NextRequest, NextResponse } from 'next/server';
import { brandingStore, validateBranding, MAX_BRANDING_NAME } from '@/lib/branding-store';
import { requireAccess, requireAdmin } from '@/lib/access';
import { revalidatePublicMenu } from '@/lib/menu-cache';
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
      branding: branding ?? { userId: access.restaurantId, name: '', logoUrl: null, updatedAt: null },
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
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_BRANDING_NAME) : '';
    const logoUrl =
      body.logoUrl === null || body.logoUrl === undefined || body.logoUrl === ''
        ? null
        : String(body.logoUrl);

    const fieldError = validateBranding({ name, logoUrl });
    if (fieldError) {
      return NextResponse.json({ error: fieldError }, { status: 400 });
    }

    const branding = await brandingStore.upsert(admin.restaurantId, { name, logoUrl });
    revalidatePublicMenu(admin.restaurantId);
    return NextResponse.json({ branding });
  } catch (error) {
    logError('settings.PUT', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
