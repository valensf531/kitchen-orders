// Da de alta la cuenta DUEÑA de un restaurante (rol admin, sin ownerId).
// Uso:
//   DATABASE_URL="..." node scripts/create-owner.mjs --email dueno@ejemplo.com --password ClaveSegura123 --name "Nombre"
// También lee .env.local/.env si existen. No crea sesión: el dueño entra
// por /sign-in con estas credenciales.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
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

const sql = neon(process.env.DATABASE_URL);
const existing = await sql`SELECT id FROM "user" WHERE lower(email) = ${email} LIMIT 1`;
if (existing.length > 0) {
  console.error('Ese email ya está registrado.');
  process.exit(1);
}

const id = randomUUID().replace(/-/g, '');
const now = new Date().toISOString();
const hash = await hashPassword(password);
await sql`
  INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt", role, "ownerId")
  VALUES (${id}, ${name}, ${email}, false, ${now}, ${now}, 'admin', NULL)
`;
await sql`
  INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
  VALUES (${randomUUID().replace(/-/g, '')}, ${id}, 'credential', ${id}, ${hash}, ${now}, ${now})
`;
console.log(`Dueño creado: ${name} <${email}> (id ${id}). Ya puede entrar por /sign-in.`);
