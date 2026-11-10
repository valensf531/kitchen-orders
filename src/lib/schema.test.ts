import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const EXPECTED_TABLES = [
  'account',
  'cash_sessions',
  'menu_categories',
  'menu_items',
  'menu_tags',
  'orders',
  'payments',
  'restaurant_settings',
  'session',
  'tables',
  'user',
  'verification',
  'zones',
];

/*
 * La migración real (scripts/migrate.mjs) separa el archivo por ';' y quita
 * las líneas de comentario. El test replica exactamente esa lógica para
 * verificar que una base vacía arranca y que la migración es idempotente.
 */
function schemaStatements(): string[] {
  const schema = readFileSync(resolve(process.cwd(), 'src/lib/schema.sql'), 'utf8');
  return schema
    .split(';')
    .map((chunk) =>
      chunk
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

async function tableNames(db: PGlite): Promise<string[]> {
  const result = await db.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name`,
  );
  return result.rows.map((row) => row.table_name);
}

async function columnNames(db: PGlite, table: string): Promise<string[]> {
  const result = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  );
  return result.rows.map((row) => row.column_name);
}

describe('schema.sql', () => {
  it('crea todas las tablas en una base vacía y se puede repetir', async () => {
    const db = new PGlite();
    const statements = schemaStatements();

    try {
      for (const statement of statements) {
        await db.exec(statement);
      }

      expect(await tableNames(db)).toEqual(EXPECTED_TABLES);

      const orderColumns = await columnNames(db, 'orders');
      expect(orderColumns).toEqual(
        expect.arrayContaining([
          'id',
          'user_id',
          'table_number',
          'items',
          'total',
          'status',
          'paid_at',
          'started_by',
          'finished_by',
          'zone',
          'table_id',
          'display_number',
          'client_order_id',
          'payment_method',
          'paid_by',
          'cash_session_id',
        ]),
      );

      const settingsColumns = await columnNames(db, 'restaurant_settings');
      expect(settingsColumns).toEqual(
        expect.arrayContaining(['timezone', 'currency_code', 'currency_symbol']),
      );

      const userColumns = await columnNames(db, 'user');
      expect(userColumns).toEqual(expect.arrayContaining(['id', 'email', 'role', 'ownerId']));

      // Debe poder crear el dueño con el mismo SQL que scripts/create-owner.mjs.
      await db.query(
        `INSERT INTO "user"
          (id, name, email, "emailVerified", "createdAt", "updatedAt", role, "ownerId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        ['owner-1', 'Dueño', 'dueno@example.com', false, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 'admin', null],
      );
      await db.query(
        `INSERT INTO account
          (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        ['account-1', 'owner-1', 'credential', 'owner-1', 'hash', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
      );

      // Segunda pasada: la migración debe ser idempotente incluso con datos.
      for (const statement of statements) {
        await db.exec(statement);
      }

      expect(await tableNames(db)).toEqual(EXPECTED_TABLES);
      const owner = await db.query<{ role: string }>(
        `SELECT role FROM "user" WHERE email = $1`,
        ['dueno@example.com'],
      );
      expect(owner.rows[0]?.role).toBe('admin');
    } finally {
      await db.close();
    }
  }, 30_000);
});
