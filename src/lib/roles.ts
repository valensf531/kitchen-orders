/* Roles por restaurante: 'admin' ve todo, 'staff' opera salón y caja,
   'kitchen' solo ve cocina. El restaurante efectivo es el dueño de los
   datos: tu propio id, o el ownerId si tu cuenta fue vinculada como
   personal de otro restaurante. */

export const ADMIN_ROLE = 'admin' as const;
export const STAFF_ROLE = 'staff' as const;
export const KITCHEN_ROLE = 'kitchen' as const;

export type AppRole = typeof ADMIN_ROLE | typeof STAFF_ROLE | typeof KITCHEN_ROLE;

export interface AccessContext {
  /* Id del usuario autenticado (quién sos). */
  userId: string;
  /* Id del dueño de los datos (sobre qué restaurante operás). */
  restaurantId: string;
  role: AppRole;
  isAdmin: boolean;
  /* Nombre para defaults (p. ej. cliente sin nombre). */
  name: string | null;
}

type UnknownUser = {
  id?: unknown;
  role?: unknown;
  ownerId?: unknown;
  name?: unknown;
} | null | undefined;

/* Normaliza el rol crudo de la sesión. Ante cualquier duda: staff
   solo si hay vínculo; si no, admin del propio restaurante. La cocina
   es personal vinculado con rol explícito 'kitchen'. */
export function resolveRole(raw: UnknownUser): { role: AppRole; ownerId: string | null } {
  const ownerId = typeof raw?.ownerId === 'string' && raw.ownerId.length > 0 ? raw.ownerId : null;
  if (ownerId) {
    if (raw?.role === KITCHEN_ROLE) return { role: KITCHEN_ROLE, ownerId };
    return { role: STAFF_ROLE, ownerId };
  }
  if (raw?.role === STAFF_ROLE) return { role: STAFF_ROLE, ownerId: null };
  return { role: ADMIN_ROLE, ownerId: null };
}

/* Construye el contexto de acceso desde el user de la sesión.
   Devuelve null si no hay usuario válido. */
export function buildAccess(raw: UnknownUser): AccessContext | null {
  if (!raw || typeof raw.id !== 'string' || raw.id.length === 0) return null;
  const { role, ownerId } = resolveRole(raw);
  return {
    userId: raw.id,
    restaurantId: ownerId ?? raw.id,
    role,
    isAdmin: role === ADMIN_ROLE,
    name: typeof raw.name === 'string' && raw.name.length > 0 ? raw.name : null,
  };
}
