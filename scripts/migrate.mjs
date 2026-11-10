// Aplica src/lib/schema.sql contra DATABASE_URL (Postgres/Neon).
// Incluye las tablas de la app y las de Better Auth para que una base nueva
// quede completa con un solo comando.
// Uso: npm run migrate  (requiere DATABASE_URL en el entorno o .env.local)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Carga mínima de .env.local sin dependencias extra.
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
  console.error('Falta DATABASE_URL. Definila en el entorno o en .env.local.');
  process.exit(1);
}

function sslFor(url) {
  if (/[?&]sslmode=(disable|allow|prefer)\b/i.test(url)) return undefined;
  if (/[?&]sslmode=(require|verify-ca|verify-full)\b/i.test(url) || url.includes('neon.tech')) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

const schemaPath = resolve(root, 'src/lib/schema.sql');
const schema = readFileSync(schemaPath, 'utf8');

const client = new pg.Client({ connectionString, ssl: sslFor(connectionString) });
await client.connect();
try {
  /* Postgres ejecuta varios statements en un solo query() cuando no hay
     parámetros (protocolo simple). Todo el esquema es idempotente. */
  await client.query('BEGIN');
  await client.query(schema);
  await client.query('COMMIT');
  console.log(`Migración OK: ${schemaPath}`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  await client.end();
}
