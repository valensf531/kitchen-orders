// Backup completo de la base del cliente con pg_dump.
// Uso: npm run db:backup   (DATABASE_URL en env o .env.local)
// Salida: backups/lumen-YYYYMMDD-HHmmss.dump (BACKUP_DIR para cambiarla).
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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

const dir = resolve(root, process.env.BACKUP_DIR || 'backups');
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const file = resolve(dir, `lumen-${stamp}.dump`);

const pgDump = process.env.PG_DUMP || 'pg_dump';
const result = spawnSync(
  pgDump,
  ['--format=custom', '--no-owner', '--no-privileges', '--file', file, connectionString],
  { stdio: 'inherit' },
);

if (result.error?.code === 'ENOENT') {
  console.error(`No se encontró ${pgDump}. Instalá postgresql-client o definí PG_DUMP.`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error('pg_dump falló.');
  process.exit(result.status ?? 1);
}
console.log(`Backup OK: ${file}`);
