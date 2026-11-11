import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { menuStore } from '@/lib/menu-store';
import { brandingStore } from '@/lib/branding-store';
import { DEFAULT_MENU_THEME } from '@/lib/menu-theme';
import { normalizeMenuStyle } from '@/lib/menu-style';
import { tableStore } from '@/lib/table-store';
import { zoneStore } from '@/lib/zone-store';
import { resolvePublicTable } from '@/lib/public-table';
import { orderStore } from '@/lib/store';
import { resolveOrderItems } from '@/lib/pricing';
import { checkRateLimit } from '@/lib/rate-limit';
import { publicMenuTag, revalidatePublicMenu } from '@/lib/menu-cache';
import { revalidateStats } from '@/lib/stats-cache';
import { verifyTableToken } from '@/lib/table-token';
import { logError } from '@/lib/log';

function restaurantId(request: NextRequest) {
  return new URL(request.url).searchParams.get('restaurant');
}

/* Armado del payload del menú público con caché y tag de invalidación. */
const loadPublicMenu = (userId: string) =>
  unstable_cache(
    async () => {
      const [categories, items, tables, tags, itemCounts, branding, zones] = await Promise.all([
        menuStore.getCategories(userId),
        menuStore.getItems(userId),
        tableStore.getAll(userId),
        menuStore.getTags(userId),
        orderStore.getItemCounts(userId),
        brandingStore.getByUserId(userId).catch(() => null),
        zoneStore.getByUserId(userId).catch(() => []),
      ]);

      const availableItems = items
        .filter((item) => item.available)
        .map((item) => ({
          ...item,
          price: Number(item.price) || 0,
          /* La foto se sirve aparte con cache inmutable para mantener liviano el JSON. */
          imageUrl: item.imageUrl
            ? `/api/public/menu/image/${item.id}?v=${encodeURIComponent(item.updatedAt)}&restaurant=${encodeURIComponent(userId)}`
            : undefined,
        }));

      /* Los más pedidos: prioriza órdenes nuevas (por id), con fallback por nombre. */
      const popularItems = availableItems
        .map((item) => ({
          id: item.id,
          count:
            itemCounts.byMenuItemId.get(item.id) ??
            itemCounts.byName.get(item.name.trim().toLowerCase()) ??
            0,
        }))
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      return {
        restaurantId: userId,
        menuStyle: normalizeMenuStyle(branding?.menuStyle),
        theme: branding?.theme ?? DEFAULT_MENU_THEME,
        currencySymbol: branding?.currencySymbol ?? '$',
        currencyCode: branding?.currencyCode ?? 'ARS',
        branding: branding
          ? { name: branding.name, logoUrl: branding.logoUrl }
          : { name: '', logoUrl: null },
        categories,
        items: availableItems,
        tags,
        popularItems,
        tables: tables.map((table) => ({
          id: table.id,
          number: Number(table.number),
          zone: String(table.zone),
        })),
        zones: zones.map((zone) => ({ slug: zone.slug, name: zone.name })),
      };
    },
    ['public-menu', userId],
    { tags: [publicMenuTag(userId)], revalidate: 60 },
  )();

export async function GET(request: NextRequest) {
  const userId = restaurantId(request) || (await menuStore.getPublicRestaurantId());
  if (!userId) {
    return NextResponse.json({ error: 'Todavía no hay un menú público configurado' }, { status: 404 });
  }
  try {
    return NextResponse.json(await loadPublicMenu(userId));
  } catch (error) {
    logError('public-menu.GET', error);
    return NextResponse.json({ error: 'No se pudo cargar el menú' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = body.restaurantId;
    const tableNumber = Number(body.tableNumber);
    if (
      !userId ||
      !Number.isInteger(tableNumber) ||
      tableNumber <= 0 ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json({ error: 'Restaurante, mesa e items son obligatorios' }, { status: 400 });
    }

    /* Límite por IP + mesa para frenar spam de pedidos. */
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const limit = checkRateLimit(`public-order:${ip}:${userId}:${tableNumber}`, 10, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados pedidos seguidos. Esperá un momento e intentá de nuevo.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.max(1, Math.ceil(limit.resetAfterMs / 1000))),
            'X-RateLimit-Remaining': '0',
          },
        },
      );
    }

    const tables = await tableStore.getAll(userId);
    const requestedZone = typeof body.zone === 'string' ? body.zone.trim() : '';
    /* La mesa debe existir y el id coincidir con el número (nada de ids
       viejos con otro número): si no, 400/409 con mensaje claro. */
    const resolvedTable = resolvePublicTable(tables, {
      tableId: body.tableId,
      tableNumber,
      zone: requestedZone,
    });
    if (!resolvedTable.ok) {
      return NextResponse.json({ error: resolvedTable.error }, { status: resolvedTable.status });
    }
    const table = tables.find((t) => t.id === resolvedTable.table.id);
    if (!table) {
      return NextResponse.json({ error: 'La mesa no existe' }, { status: 400 });
    }

    /* El QR de la mesa incluye un token firmado: sin él no se puede pedir. */
    if (
      !verifyTableToken(body.tableToken, {
        restaurantId: userId,
        tableId: table.id,
        tableNumber: Number(table.number),
        zone: String(table.zone),
      })
    ) {
      return NextResponse.json(
        { error: 'QR inválido. Escaneá el QR de tu mesa para hacer el pedido.' },
        { status: 403 },
      );
    }

    const rawIdempotencyKey =
      typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    const clientOrderId = rawIdempotencyKey ? rawIdempotencyKey.slice(0, 100) : undefined;
    if (clientOrderId) {
      const existing = await orderStore.getByClientOrderId(userId, clientOrderId);
      if (existing) {
        return NextResponse.json({ order: existing, duplicate: true }, { status: 200 });
      }
    }

    /* Precios y total SIEMPRE desde la base: se ignora lo que manda el cliente. */
    const menuItems = await menuStore.getItems(userId);
    const categories = await menuStore.getCategories(userId);
    const categoryKinds = new Map(categories.map((c) => [c.id, c.kind] as const));
    const resolved = resolveOrderItems(menuItems, body.items, { strict: true, categoryKinds });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    if (table.status === 'available' || table.status === 'paid') {
      await orderStore.closeTableAccount(userId, table.number, table.zone, {
        tableId: table.id,
      });
    }

    let order;
    try {
      order = await orderStore.create({
        userId,
        customerName:
          typeof body.customerName === 'string' && body.customerName.trim()
            ? body.customerName.trim().slice(0, 100)
            : `Cliente mesa ${tableNumber}`,
        tableNumber,
        tableId: table.id,
        clientOrderId,
        zone: table.zone,
        source: 'qr-menu',
        notes:
          typeof body.notes === 'string' && body.notes.trim()
            ? body.notes.trim().slice(0, 300)
            : undefined,
        items: resolved.items,
        total: resolved.total,
      });
    } catch (error) {
      /* Otra pestaña/retry ganó la carrera: devolvemos el pedido existente. */
      if (clientOrderId && (error as { code?: string })?.code === '23505') {
        const existing = await orderStore.getByClientOrderId(userId, clientOrderId);
        if (existing) {
          return NextResponse.json({ order: existing, duplicate: true }, { status: 200 });
        }
      }
      throw error;
    }
    await tableStore.updateStatus(userId, table.id, 'occupied');
    revalidatePublicMenu(userId);
    revalidateStats(userId);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    logError('public-menu.POST', error);
    return NextResponse.json({ error: 'No se pudo enviar el pedido' }, { status: 500 });
  }
}
