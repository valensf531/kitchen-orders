import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { requireAdmin } from '@/lib/access';
import { statsStore, type ProductSaleRow } from '@/lib/stats-store';
import { menuStore } from '@/lib/menu-store';
import { statsTag } from '@/lib/stats-cache';
import { logError } from '@/lib/log';

/* Zona horaria del restaurante para agrupar por día/hora. */
const TIMEZONE = 'America/Argentina/Buenos_Aires';

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface StatsProduct {
  key: string;
  name: string;
  categoryId: string;
  categoryName: string;
  units: number;
  revenue: number;
}

export async function GET(request: NextRequest) {
  try {
    /* Estadísticas solo para admin: ni la UI ni esta API exponen números al personal. */
    const access = await requireAdmin();
    if (!access) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = access.restaurantId;

    const { searchParams } = new URL(request.url);
    const to = parseDate(searchParams.get('to')) ?? new Date();
    const from =
      parseDate(searchParams.get('from')) ??
      new Date(to.getTime() - 30 * 86_400_000);
    if (from.getTime() >= to.getTime()) {
      return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 });
    }

    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const previousFromIso = new Date(from.getTime() - (to.getTime() - from.getTime())).toISOString();

    const payload = await unstable_cache(
      async () => {
        const [summary, previous, productRows, byDay, byHour, byZone, byChannel, tables, stages, slowest, menuItems, menuCategories] =
          await Promise.all([
            statsStore.getSummary(userId, fromIso, toIso),
            statsStore.getSummary(userId, previousFromIso, fromIso),
            statsStore.getProductSales(userId, fromIso, toIso),
            statsStore.getSalesByDay(userId, fromIso, toIso, TIMEZONE),
            statsStore.getSalesByHour(userId, fromIso, toIso, TIMEZONE),
            statsStore.getSalesByZone(userId, fromIso, toIso),
            statsStore.getSalesByChannel(userId, fromIso, toIso),
            statsStore.getTableStats(userId, fromIso, toIso),
            statsStore.getStageTimings(userId, fromIso, toIso),
            statsStore.getProductPrepTimes(userId, fromIso, toIso),
            menuStore.getItems(userId),
            menuStore.getCategories(userId),
          ]);

        /* Mapeo de productos a categorías: por id, con fallback por nombre. */
        const itemById = new Map(menuItems.map((item) => [item.id, item]));
        const itemByName = new Map(
          menuItems.map((item) => [item.name.trim().toLowerCase(), item]),
        );
        const categoryById = new Map(menuCategories.map((category) => [category.id, category.name]));

        const products: StatsProduct[] = productRows.map((row: ProductSaleRow) => {
          const item = itemById.get(row.key) ?? itemByName.get(row.key);
          return {
            key: row.key,
            name: item?.name ?? row.name,
            categoryId: item?.categoryId ?? '',
            categoryName: item ? (categoryById.get(item.categoryId) ?? 'Sin categoría') : 'Fuera de menú',
            units: row.units,
            revenue: row.revenue,
          };
        });

        const categories = menuCategories
          .map((category) => {
            const rows = products.filter((product) => product.categoryId === category.id);
            return {
              id: category.id,
              name: category.name,
              units: rows.reduce((sum, product) => sum + product.units, 0),
              revenue: rows.reduce((sum, product) => sum + product.revenue, 0),
            };
          })
          .sort((a, b) => b.revenue - a.revenue || b.units - a.units);

        /* Platos del menú activo sin ventas en el período. */
        const soldKeys = new Set(products.map((product) => product.key));
        const unsold = menuItems
          .filter((item) => item.available && !soldKeys.has(item.id) && !soldKeys.has(item.name.trim().toLowerCase()))
          .map((item) => ({ id: item.id, name: item.name }));

        return {
          range: { from: fromIso, to: toIso, timezone: TIMEZONE },
          summary,
          previous: {
            orders: previous.orders,
            revenue: previous.revenue,
            averageTicket: previous.averageTicket,
          },
          products,
          categories,
          unsold,
          salesByDay: byDay,
          salesByHour: byHour,
          zones: byZone,
          channels: byChannel,
          tables,
          stages,
          slowestProducts: slowest,
        };
      },
      ['stats', userId, fromIso, toIso],
      { tags: [statsTag(userId)], revalidate: 60 },
    )();

    return NextResponse.json(payload);
  } catch (error) {
    logError('stats.GET', error);
    return NextResponse.json(
      { error: 'No se pudieron cargar las estadísticas' },
      { status: 500 },
    );
  }
}
