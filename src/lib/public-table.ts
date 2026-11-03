/* Resolución de la mesa de un pedido del menú público (QR): pura y testeada.
   Reglas:
   - Si viene tableId, debe existir Y coincidir con tableNumber (y con la
     zona si se indica): el cliente nunca debe poder colar un id viejo con
     otro número.
   - Sin tableId: el número debe resolver a una única mesa (o a la de la
     zona pedida); si hay varias sin zona, se pide elegir salón. */

export interface PublicTableRef {
  id: string;
  number: number;
  zone: string;
}

export type ResolveTableResult =
  | { ok: true; table: PublicTableRef }
  | { ok: false; error: string; status: 400 | 409 };

export function resolvePublicTable(
  tables: PublicTableRef[],
  input: { tableId?: unknown; tableNumber: number; zone?: unknown },
): ResolveTableResult {
  const zone = typeof input.zone === 'string' && input.zone.trim() ? input.zone.trim() : '';

  if (typeof input.tableId === 'string' && input.tableId.length > 0) {
    const byId = tables.find((t) => t.id === input.tableId);
    if (!byId) {
      return { ok: false, error: 'La mesa no existe', status: 400 };
    }
    if (Number(byId.number) !== input.tableNumber) {
      return { ok: false, error: 'La mesa no coincide. Revisá el número.', status: 400 };
    }
    if (zone && byId.zone !== zone) {
      return { ok: false, error: 'La mesa no está en ese salón.', status: 400 };
    }
    return { ok: true, table: byId };
  }

  const matching = tables.filter((t) => Number(t.number) === input.tableNumber);
  if (matching.length === 0) {
    return { ok: false, error: 'La mesa no existe. Revisá el número.', status: 400 };
  }
  if (zone) {
    const inZone = matching.find((t) => t.zone === zone);
    if (!inZone) {
      return { ok: false, error: 'Esa mesa no está en ese salón.', status: 400 };
    }
    return { ok: true, table: inZone };
  }
  if (matching.length > 1) {
    return { ok: false, error: 'Seleccioná el salón de la mesa', status: 409 };
  }
  return { ok: true, table: matching[0] };
}
