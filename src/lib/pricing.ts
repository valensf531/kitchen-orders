import type { OrderItem } from '@/types/order';

/* Vista mínima del item de menú que necesita el resolvedor de precios. */
export interface PricedMenuItem {
  id: string;
  name: string;
  price: number | string;
  available: boolean;
  categoryId?: string;
}

export type ResolveOrderItemsResult =
  | { ok: true; items: OrderItem[]; total: number }
  | { ok: false; error: string };

const MAX_ITEMS = 50;
const MAX_QUANTITY = 99;
const MAX_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 300;

/*
 * Resuelve los items de un pedido contra el menú: usa SIEMPRE los precios de la
 * base (nunca los del cliente), valida que los platos existan y estén
 * disponibles, normaliza cantidades y recalcula el total en el servidor.
 *
 * - strict: true  → endpoint público: rechaza cualquier item que no esté en el menú.
 * - strict: false → endpoint de personal: permite items libres con precio validado.
 */
export function resolveOrderItems(
  menuItems: PricedMenuItem[],
  incoming: unknown,
  options: {
    strict: boolean;
    /* kind por categoryId ('drink' para bebidas): la cocina lo usa para el
       checkbox de entrega. Sin mapa, el item queda sin categoría. */
    categoryKinds?: Map<string, 'food' | 'drink'>;
  },
): ResolveOrderItemsResult {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return { ok: false, error: 'El pedido no tiene items' };
  }
  if (incoming.length > MAX_ITEMS) {
    return { ok: false, error: `El pedido admite como máximo ${MAX_ITEMS} items` };
  }

  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const byName = new Map(
    menuItems.map((item) => [item.name.trim().toLowerCase(), item]),
  );

  const items: OrderItem[] = [];
  let total = 0;

  for (const entry of incoming) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: 'Item inválido' };
    }

    const raw = entry as {
      id?: unknown;
      menuItemId?: unknown;
      name?: unknown;
      quantity?: unknown;
      price?: unknown;
      notes?: unknown;
    };

    const quantity = Math.min(MAX_QUANTITY, Math.max(1, Number(raw.quantity) || 1));
    const notes =
      typeof raw.notes === 'string' && raw.notes.trim()
        ? raw.notes.trim().slice(0, MAX_NOTES_LENGTH)
        : undefined;

    const menuItem =
      (typeof raw.id === 'string' && byId.get(raw.id)) ||
      (typeof raw.menuItemId === 'string' && byId.get(raw.menuItemId)) ||
      (typeof raw.name === 'string' ? byName.get(raw.name.trim().toLowerCase()) : undefined);

    if (menuItem) {
      if (!menuItem.available) {
        return { ok: false, error: `${menuItem.name} no está disponible ahora` };
      }
      const price = Number(menuItem.price) || 0;
      const kind =
        (menuItem.categoryId && options.categoryKinds?.get(menuItem.categoryId)) ?? undefined;
      items.push({
        name: menuItem.name,
        quantity,
        price,
        notes,
        menuItemId: menuItem.id,
        ...(kind ? { category: kind } : {}),
      });
      total += price * quantity;
      continue;
    }

    if (options.strict) {
      return { ok: false, error: 'Hay items que no están en el menú' };
    }

    /* Personal puede cargar items fuera del menú: exigimos nombre y precio válidos. */
    const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, MAX_NAME_LENGTH) : '';
    const price = Number(raw.price);
    if (!name || !Number.isFinite(price) || price < 0) {
      return { ok: false, error: 'Item inválido' };
    }
    items.push({ name, quantity, price: Math.round(price * 100) / 100, notes });
    total += price * quantity;
  }

  return { ok: true, items, total: Math.round(total * 100) / 100 };
}
