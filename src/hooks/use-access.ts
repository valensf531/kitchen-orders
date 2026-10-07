'use client';

import { useSession } from '@/lib/auth-client';
import { resolveRole, ADMIN_ROLE, KITCHEN_ROLE, type AppRole } from '@/lib/roles';

/* Rol del usuario actual desde la sesión. `loaded` indica que la sesión
   ya resolvió: ante la duda se oculta lo sensible (secure default).
   Usa la misma resolución que el backend (roles.ts, fuente única). */
export function useAccess(): { isAdmin: boolean; isKitchen: boolean; role: AppRole; loaded: boolean } {
  const { data: session, isPending } = useSession();
  const user = session?.user as { id?: unknown; role?: unknown; ownerId?: unknown } | undefined;
  const hasUser = typeof user?.id === 'string' && user.id.length > 0;
  const { role } = resolveRole(hasUser ? user : null);
  const isAdmin = hasUser && role === ADMIN_ROLE;
  return { isAdmin, isKitchen: hasUser && role === KITCHEN_ROLE, role, loaded: !isPending };
}
