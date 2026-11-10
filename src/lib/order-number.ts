/*
 * Número visible y estable de un pedido. Los pedidos nuevos traen
 * displayNumber desde la secuencia de la base. El fallback por hash queda
 * solo para pedidos históricos sin backfill.
 */
export function getOrderDisplayNumber(
  order: Pick<{ id: string; displayNumber?: number }, 'id' | 'displayNumber'>,
): number {
  if (typeof order.displayNumber === 'number' && order.displayNumber > 0) {
    return order.displayNumber;
  }
  const legacy = order.id.match(/ORD-(\d+)$/);
  if (legacy) return parseInt(legacy[1], 10);
  let hash = 0;
  for (const ch of order.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (hash % 900) + 100;
}
