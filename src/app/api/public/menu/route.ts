import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { menuStore } from '@/lib/menu-store';
import { brandingStore } from '@/lib/branding-store';
import { tableStore } from '@/lib/table-store';
import { orderStore } from '@/lib/store';
import { resolveOrderItems } from '@/lib/pricing';
import { checkRateLimit } from '@/lib/rate-limit';
import { publicMenuTag, revalidatePublicMenu } from '@/lib/menu-cache';
import { revalidateStats } from '@/lib/stats-cache';
import { logError } from '@/lib/log';

function restaurantId(request: NextRequest) {
  return new URL(request.url).searchParams.get('restaurant');
}

/* Armado del payload del menú público con caché y tag de invalidación. */
const loadPublicMenu = (userId: string) =>
  unstable_cache(
    async () => {
      const [categories, items, tables, tags, itemCounts, branding] = await Promise.all([
        menuStore.getCategories(userId),
        menuStore.getItems(userId),
        tableStore.getAll(userId),
        menuStore.getTags(userId),
        orderStore.getItemCounts(userId),
        brandingStore.getByUserId(userId).catch(() => null),
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

    /* Precios y total SIEMPRE desde la base: se ignora lo que manda el cliente. */
    const menuItems = await menuStore.getItems(userId);
    const categories = await menuStore.getCategories(userId);
    const categoryKinds = new Map(categories.map((c) => [c.id, c.kind] as const));
    const resolved = resolveOrderItems(menuItems, body.items, { strict: true, categoryKinds });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const tables = await tableStore.getAll(userId);
    const requestedZone = typeof body.zone === 'string' ? body.zone.trim() : '';
    const matchingTables = tables.filter((item) => Number(item.number) === tableNumber);
    const table = (body.tableId && tables.find((item) => item.id === body.tableId))
      || (requestedZone ? matchingTables.find((item) => String(item.zone) === requestedZone) : matchingTables.length === 1 ? matchingTables[0] : undefined);
    if (matchingTables.length > 1 && !table) return NextResponse.json({ error: 'Seleccioná el salón de la mesa' }, { status: 409 });
    if (!table) return NextResponse.json({ error: 'La mesa no existe' }, { status: 400 });
    if (table.status === 'available' || table.status === 'paid') {
      await orderStore.closeTableAccount(userId, table.number, table.zone);
    }

    const order = await orderStore.create({
      userId,
      customerName:
        typeof body.customerName === 'string' && body.customerName.trim()
          ? body.customerName.trim().slice(0, 100)
          : `Cliente mesa ${tableNumber}`,
      tableNumber,
      zone: table.zone,
      source: 'qr-menu',
      notes:
        typeof body.notes === 'string' && body.notes.trim()
          ? body.notes.trim().slice(0, 300)
          : undefined,
      items: resolved.items,
      total: resolved.total,
    });
    await tableStore.updateStatus(userId, table.id, 'occupied');
    revalidatePublicMenu(userId);
    revalidateStats(userId);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    logError('public-menu.POST', error);
    return NextResponse.json({ error: 'No se pudo enviar el pedido' }, { status: 500 });
  }
}
