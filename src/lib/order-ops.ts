import { orderStore } from '@/lib/store';
import { tableStore } from '@/lib/table-store';

export { getOrderDisplayNumber } from '@/lib/order-number';

/*
 * Al cancelar o borrar el último pedido de una mesa, la mesa queda sin cuenta
 * abierta y se libera (pasa a 'available') para que caja y salón la vean
 * desocupada de inmediato.
 */
export async function freeTableIfEmpty(
  userId: string,
  table: { id?: string; number?: number; zone?: string | null },
): Promise<void> {
  const tables = await tableStore.getAll(userId);
  const matched = table.id
    ? tables.find((candidate) => candidate.id === table.id)
    : table.number
      ? tables.find(
          (candidate) =>
            Number(candidate.number) === table.number && (!table.zone || candidate.zone === table.zone),
        )
      : undefined;

  if (!matched) return;

  const stillOpen = await orderStore.hasOpenOrders(userId, {
    id: matched.id,
    number: matched.number,
    zone: matched.zone,
  });
  if (stillOpen) return;

  if (matched.status !== 'available') {
    await tableStore.updateStatus(userId, matched.id, 'available');
  }
}
