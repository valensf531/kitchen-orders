// Restaura un backup .dump sobre DATABASE_URL. DESTRUCTIVO: pg_restore
// elimina los objetos existentes antes de recrearlos.
// Uso: npm run db:restore -- --file backups/lumen-....dump --yes
import { existsSync, readFileSync } from 'node:fs';
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

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
}

const file = arg('file');
const confirmed = process.argv.includes('--yes') || process.env.RESTORE_CONFIRM === '1';
if (!file) {
  console.error('Falta --file <backup.dump>');
  process.exit(1);
}
if (!existsSync(file)) {
  console.error(`No existe el archivo: ${file}`);
  process.exit(1);
}
if (!confirmed) {
  console.error('Restore destructivo: repetí con --yes (o RESTORE_CONFIRM=1).');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (env o .env.local).');
  process.exit(1);
}

const pgRestore = process.env.PG_RESTORE || 'pg_restore';
const result = spawnSync(
  pgRestore,
  [
    '--clean',
    '--if-exists',
    '--no-owner',
    '--no-privileges',
    '--dbname',
    process.env.DATABASE_URL,
    file,
  ],
  { stdio: 'inherit' },
);

if (result.error?.code === 'ENOENT') {
  console.error(`No se encontró ${pgRestore}. Instalá postgresql-client o definí PG_RESTORE.`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error('pg_restore falló.');
  process.exit(result.status ?? 1);
}
console.log(`Restore OK: ${file}`);
