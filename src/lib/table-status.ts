import type { TableStatus } from '@/types/table';

/* Regla de cambios manuales de estado (Salón): con cuenta abierta no se
   puede liberar ni dar por pagada a mano — eso se cobra en Caja. Ocupar o
   marcar pago pendiente no esconde ninguna cuenta, así que se permite.
   El cobro (closeAccount) siempre está permitido. Pura y testeable. */
export function validateManualTableStatusChange(input: {
  targetStatus: TableStatus;
  hasOpenOrders: boolean;
  closeAccount: boolean;
}): string | null {
  if (input.closeAccount) return null;
  if (
    input.hasOpenOrders &&
    (input.targetStatus === 'available' || input.targetStatus === 'paid')
  ) {
    return 'La mesa tiene cuenta abierta. Cobrala en Caja.';
  }
  return null;
}
