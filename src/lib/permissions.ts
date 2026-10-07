import type { AppRole } from './roles';

/* La cocina solo trabaja sobre pedidos existentes: no crea pedidos
   (eso es del mozo/vendedor) ni toca mesas (eso es de salón/caja).
   Helpers separados para poder divergir sin tocar las rutas. */
export function canCreateOrders(role: AppRole): boolean {
  return role !== 'kitchen';
}

export function canOperateTables(role: AppRole): boolean {
  return role !== 'kitchen';
}
