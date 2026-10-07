import { orderStore } from '@/lib/store';
import { tableStore } from '@/lib/table-store';

/* Número corto y estable para mostrar en cocina ("Pedido #123").
   Los ORD-0001 históricos conservan su número; los IDs nuevos
   (ORD-<base36>-<rand>) no matchean /ORD-(\d+)/, así que se deriva un
   número del hash (antes todos mostraban #001). */
export function getOrderDisplayNumber(orderId: string): number {
  const legacy = orderId.match(/ORD-(\d+)$/);
  if (legacy) return parseInt(legacy[1], 10);
  let hash = 0;
  for (const ch of orderId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (hash % 900) + 100;
}

/*
 * Al cancelar o borrar el último pedido de una mesa, la mesa queda sin cuenta
 * abierta y se libera (pasa a 'available') para que caja y salón la vean
 * desocupada de inmediato.
 */
export async function freeTableIfEmpty(
  userId: string,
  tableNumber?: number,
  zone?: string | null,
): Promise<void> {
  if (!tableNumber) return;

  const stillOpen = await orderStore.hasOpenOrders(userId, tableNumber, zone ?? null);
  if (stillOpen) return;

  const tables = await tableStore.getAll(userId);
  const table = tables.find(
    (candidate) =>
      Number(candidate.number) === tableNumber && (!zone || candidate.zone === zone),
  );
  if (table && table.status !== 'available') {
    await tableStore.updateStatus(userId, table.id, 'available');
  }
}
