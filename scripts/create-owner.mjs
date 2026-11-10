// Da de alta la cuenta DUEÑA de un restaurante (rol admin, sin ownerId).
// Uso:
//   DATABASE_URL="..." node scripts/create-owner.mjs --email dueno@ejemplo.com --password ClaveSegura123 --name "Nombre"
// También lee .env.local/.env si existen. No crea sesión: el dueño entra
// por /sign-in con estas credenciales.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const name = (arg('name') ?? '').trim().slice(0, 100);
const email = (arg('email') ?? '').trim().toLowerCase();
const password = arg('password') ?? '';

if (!name) {
  console.error('Falta --name');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Email inválido (--email)');
  process.exit(1);
}
if (password.length < 8) {
  console.error('La contraseña debe tener al menos 8 caracteres (--password)');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (env o .env.local).');
  process.exit(1);
}

function sslFor(url) {
  if (/[?&]sslmode=(disable|allow|prefer)\b/i.test(url)) return undefined;
  if (/[?&]sslmode=(require|verify-ca|verify-full)\b/i.test(url) || url.includes('neon.tech')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

const connectionString = process.env.DATABASE_URL;
const client = new pg.Client({ connectionString, ssl: sslFor(connectionString) });
await client.connect();

try {
  const existing = await client.query('SELECT id FROM "user" WHERE lower(email) = $1 LIMIT 1', [email]);
  if (existing.rowCount > 0) {
    console.error('Ese email ya está registrado.');
    process.exit(1);
  }

  const id = randomUUID().replace(/-/g, '');
  const now = new Date().toISOString();
  const hash = await hashPassword(password);

  await client.query('BEGIN');
  await client.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, "ownerId")
     VALUES ($1, $2, $3, false, $4, $5, 'admin', NULL)`,
    [id, name, email, now, now],
  );
  await client.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
     VALUES ($1, $2, 'credential', $3, $4, $5, $6)`,
    [randomUUID().replace(/-/g, ''), id, id, hash, now, now],
  );
  await client.query('COMMIT');

  console.log(`Dueño creado: ${name} <${email}> (id ${id}). Ya puede entrar por /sign-in.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
