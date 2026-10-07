import { getSql } from '@/lib/db';

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'staff' | 'kitchen';
  createdAt: string;
}

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  ownerId: string | null;
  createdAt: string;
};

/* Personal vinculado al restaurante (cuentas cuya ownerId sos vos). */
export async function listStaff(ownerId: string): Promise<StaffUser[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, email, role, "createdAt" as "createdAt"
    FROM "user"
    WHERE "ownerId" = ${ownerId}
    ORDER BY "createdAt" ASC
  `;
  return (rows as { id: string; name: string; email: string; role: string | null; createdAt: string }[]).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === 'kitchen' ? 'kitchen' : 'staff',
    createdAt: row.createdAt,
  }));
}

export async function findByEmail(email: string): Promise<UserRow | undefined> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, email, role, "ownerId", "createdAt"
    FROM "user"
    WHERE lower(email) = ${email.toLowerCase()}
    LIMIT 1
  `;
  if (rows.length === 0) return undefined;
  const row = rows[0] as { id: string; name: string; email: string; role: string | null; ownerId: string | null; createdAt: string };
  return { id: row.id, name: row.name, email: row.email, role: row.role, ownerId: row.ownerId, createdAt: row.createdAt };
}

/* Vincula una cuenta existente como personal (conserva su login). */
export async function linkStaff(
  userId: string,
  ownerId: string,
  role: 'staff' | 'kitchen' = 'staff',
): Promise<void> {
  const sql = getSql();
  await sql`
    UPDATE "user" SET role = ${role}, "ownerId" = ${ownerId} WHERE id = ${userId}
  `;
  /* Sesiones previas fuera: el vínculo rige desde el próximo request. */
  await sql`DELETE FROM session WHERE "userId" = ${userId}`;
}

/* Borra solo las sesiones (p. ej. la auto-creada al dar de alta personal). */
export async function deleteStaffSessionsOnly(userId: string): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM session WHERE "userId" = ${userId}`;
}

/* Quita el acceso: borra sesiones, cuentas y usuario (cascada manual). */
export async function deleteStaff(userId: string, ownerId: string): Promise<boolean> {
  const sql = getSql();
  const existing = await sql`
    SELECT id FROM "user" WHERE id = ${userId} AND "ownerId" = ${ownerId} LIMIT 1
  `;
  if (existing.length === 0) return false;
  await sql`DELETE FROM session WHERE "userId" = ${userId}`;
  await sql`DELETE FROM account WHERE "userId" = ${userId}`;
  await sql`DELETE FROM "user" WHERE id = ${userId} AND "ownerId" = ${ownerId}`;
  return true;
}
