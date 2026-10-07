import { headers } from 'next/headers';
import { getAuth } from './auth';
import { buildAccess, type AccessContext } from './roles';

/* Contexto de acceso del request actual (sesión + rol + restaurante
   efectivo). Null si no hay sesión válida. */
export async function requireAccess(): Promise<AccessContext | null> {
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  return buildAccess(session?.user);
}

/* Contexto solo si es admin del restaurante efectivo. */
export async function requireAdmin(): Promise<AccessContext | null> {
  const ctx = await requireAccess();
  return ctx && ctx.isAdmin ? ctx : null;
}

export type { AccessContext };
