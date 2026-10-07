// Aplica src/lib/schema.sql contra DATABASE_URL (Neon).
// Uso: npm run migrate  (requiere DATABASE_URL en el entorno o .env.local)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

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

const schemaPath = resolve(root, 'src/lib/schema.sql');
const schema = readFileSync(schemaPath, 'utf8');

const sql = neon(connectionString);
// Neon http no acepta multi-statement: separamos por ';' de forma simple
// (schema.sql no contiene funciones con cuerpo ni ';' dentro de strings).
// Se quitan las líneas de comentario en vez de descartar el bloque.
const statements = schema
  .split(';')
  .map((chunk) =>
    chunk
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim(),
  )
  .filter((s) => s.length > 0);

// Ejecuta cada statement; los ALTER ... IF NOT EXISTS son idempotentes.
let applied = 0;
for (const statement of statements) {
  await sql.query(statement);
  applied += 1;
}
console.log(`Migración OK: ${applied} statements de ${schemaPath}`);
