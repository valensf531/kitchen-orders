import { NextRequest, NextResponse } from 'next/server';
import { orderStore } from '@/lib/store';
import { menuStore } from '@/lib/menu-store';
import { requireAccess } from '@/lib/access';
import { canCreateOrders } from '@/lib/permissions';
import { tableStore } from '@/lib/table-store';
import { resolveOrderItems } from '@/lib/pricing';
import { revalidateStats } from '@/lib/stats-cache';
import { logError } from '@/lib/log';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = access.restaurantId;
    /* ?active=1: solo órdenes activas/impagas + últimas 24h (pantallas operativas). */
    const activeOnly = new URL(request.url).searchParams.get('active') === '1';

    /* ETag: el polling de 5s responde 304 (cuerpo vacío) si nada cambió. */
    const etag = `"orders-${activeOnly ? 'active' : 'all'}-${await orderStore.getVersion(userId)}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    const orders = await orderStore.getAll(userId, { activeOnly });
    return NextResponse.json(
      { orders },
      {
        headers: {
          ETag: etag,
          'Cache-Control': 'private, max-age=0, must-revalidate',
        },
      },
    );
  } catch (error) {
    logError('orders.GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    /* Crear pedidos es del mozo/vendedor: cocina solo opera los existentes. */
    if (!canCreateOrders(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = access.restaurantId;

    const body = await request.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: items' },
        { status: 400 }
      );
    }

    /* Precios y total siempre desde el menú de la base; el personal puede
       cargar items libres con precio numérico validado. */
    const menuItems = await menuStore.getItems(userId);
    const categories = await menuStore.getCategories(userId);
    const categoryKinds = new Map(categories.map((c) => [c.id, c.kind] as const));
    const resolved = resolveOrderItems(menuItems, body.items, { strict: false, categoryKinds });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    let matchedTable;
    if (body.tableNumber) {
      const tables = body.zone
        ? await tableStore.getByZone(userId, body.zone)
        : await tableStore.getAll(userId);
      matchedTable = tables.find((item) => Number(item.number) === Number(body.tableNumber));
      if (matchedTable && (matchedTable.status === 'available' || matchedTable.status === 'paid')) {
        await orderStore.closeTableAccount(userId, matchedTable.number, matchedTable.zone);
      }
    }

    const order = await orderStore.create({
      userId,
      customerName:
        typeof body.customerName === 'string' && body.customerName.trim()
          ? body.customerName.trim().slice(0, 100)
          : (access.name ?? 'Sin nombre'),
      tableNumber: body.tableNumber,
      items: resolved.items,
      total: resolved.total,
      source: body.source || 'api',
      notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 300) : undefined,
      zone: body.zone,
    });

    if (matchedTable) await tableStore.updateStatus(userId, matchedTable.id, 'occupied');

    revalidateStats(userId);

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    logError('orders.POST', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
