// Seed mínimo para el E2E del flujo completo (CI o local con Postgres).
// Crea dueño, cocinero, zona, mesa, categoría e ítem de menú, y deja un
// e2e/seed.json con credenciales, ids y el token firmado de la mesa.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomUUID } from 'node:crypto';
import pg from 'pg';
import { hashPassword } from 'better-auth/crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const file of ['.env.local', '.env']) {
  const path = resolve(root, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const idx = trimmed.indexOf('=');
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Falta DATABASE_URL (env o .env.local).');
  process.exit(1);
}
const secret = process.env.PUBLIC_ORDER_SECRET || process.env.BETTER_AUTH_SECRET;
if (!secret) {
  console.error('Falta PUBLIC_ORDER_SECRET o BETTER_AUTH_SECRET para el token del QR.');
  process.exit(1);
}

function sslFor(url) {
  if (/[?&]sslmode=(disable|allow|prefer)\b/i.test(url)) return undefined;
  if (/[?&]sslmode=(require|verify-ca|verify-full)\b/i.test(url) || url.includes('neon.tech')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

const id = () => randomUUID().replace(/-/g, '');
const now = new Date().toISOString();
const ownerId = id();
const ownerEmail = 'e2e-owner@example.com';
const ownerPassword = 'E2ETest12345';
const kitchenId = id();
const kitchenEmail = 'e2e-kitchen@example.com';
const kitchenPassword = 'E2ETest12345';
const zoneId = id();
const zoneSlug = 'e2e_salon';
const zoneName = 'E2E Salón';
const tableId = id();
const tableNumber = 901;
const categoryId = id();
const menuItemId = id();

const encoded = Buffer.from(
  JSON.stringify({ v: 1, r: ownerId, t: tableId, n: tableNumber, z: zoneSlug }),
  'utf8',
).toString('base64url');
const tableToken = `${encoded}.${createHmac('sha256', secret).update(encoded).digest('base64url')}`;

const client = new pg.Client({ connectionString, ssl: sslFor(connectionString) });
await client.connect();

try {
  await client.query('BEGIN');

  /* Idempotente: limpia solo los datos del restaurante E2E. */
  for (const table of [
    'payments',
    'orders',
    'cash_sessions',
    'tables',
    'zones',
    'menu_items',
    'menu_categories',
    'menu_tags',
    'restaurant_settings',
  ]) {
    await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [ownerId]);
  }
  await client.query('DELETE FROM session WHERE "userId" = ANY($1)', [[ownerId, kitchenId]]);
  await client.query('DELETE FROM account WHERE "userId" = ANY($1)', [[ownerId, kitchenId]]);
  await client.query('DELETE FROM "user" WHERE id = ANY($1) OR lower(email) = ANY($2)', [
    [ownerId, kitchenId],
    [ownerEmail, kitchenEmail],
  ]);

  const ownerHash = await hashPassword(ownerPassword);
  const kitchenHash = await hashPassword(kitchenPassword);

  await client.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, "ownerId")
     VALUES ($1, $2, $3, false, $4, $4, 'admin', NULL)`,
    [ownerId, 'E2E Dueño', ownerEmail, now],
  );
  await client.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, $5, $5)`,
    [id(), ownerId, ownerId, ownerHash, now],
  );
  await client.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, "ownerId")
     VALUES ($1, $2, $3, false, $4, $4, 'kitchen', $5)`,
    [kitchenId, 'E2E Cocinero', kitchenEmail, now, ownerId],
  );
  await client.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, $5, $5)`,
    [id(), kitchenId, kitchenId, kitchenHash, now],
  );

  await client.query(
    `INSERT INTO restaurant_settings (user_id, name) VALUES ($1, $2)`,
    [ownerId, 'Restaurante E2E'],
  );
  await client.query(
    `INSERT INTO zones (id, user_id, name, slug, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [zoneId, ownerId, zoneName, zoneSlug, now],
  );
  await client.query(
    `INSERT INTO tables (id, number, zone, status, user_id, created_at, updated_at)
     VALUES ($1, $2, $3, 'available', $4, $5, $5)`,
    [tableId, tableNumber, zoneSlug, ownerId, now],
  );
  await client.query(
    `INSERT INTO menu_categories (id, user_id, name, "order", kind, created_at, updated_at)
     VALUES ($1, $2, $3, 0, 'food', $4, $4)`,
    [categoryId, ownerId, 'E2E Platos', now],
  );
  await client.query(
    `INSERT INTO menu_items (id, user_id, name, price, category_id, available, created_at, updated_at)
     VALUES ($1, $2, $3, 1500, $4, true, $5, $5)`,
    [menuItemId, ownerId, 'E2E Milanesa', categoryId, now],
  );

  await client.query('COMMIT');

  const seed = {
    restaurantId: ownerId,
    ownerEmail,
    ownerPassword,
    kitchenEmail,
    kitchenPassword,
    zone: zoneSlug,
    tableId,
    tableNumber,
    tableToken,
    menuItemId,
    menuItemName: 'E2E Milanesa',
    menuItemPrice: 1500,
  };
  const dir = resolve(root, 'e2e');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'seed.json'), `${JSON.stringify(seed, null, 2)}\n`);
  console.log(`Seed E2E OK: ${resolve(dir, 'seed.json')}`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
