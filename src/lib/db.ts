import { Pool, type PoolClient, type QueryResultRow } from 'pg';

/* Cliente SQL con la misma forma que usaba el driver de Neon:
   `sql\`SELECT ...\`` devuelve las filas y `sql.query(texto, valores)`
   queda para statements armados en runtime. Sirve tanto para un Postgres
   propio (Dokploy/compose) como para Neon por TCP. */
export interface Sql {
  <T extends QueryResultRow = QueryResultRow>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<T[]>;
}

type Queryable = Pick<PoolClient, 'query'>;

function createSql(client: Queryable): Sql {
  const run = async <T extends QueryResultRow>(
    text: string,
    values: unknown[] = [],
  ): Promise<T[]> => {
    const result = await client.query<T>(text, values);
    return result.rows;
  };

  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let index = 0; index < values.length; index += 1) {
      text += `$${index + 1}${strings[index + 1]}`;
    }
    return run(text, values);
  }) as Sql;

  sql.query = run;
  return sql;
}

/* Neon exige TLS; un Postgres interno normalmente no lo usa. Si la URL
   trae sslmode lo respetamos; para hosts de Neon activamos TLS sí o sí. */
function needsSsl(connectionString: string): boolean {
  if (/[?&]sslmode=(disable|allow|prefer)\b/i.test(connectionString)) return false;
  return (
    /[?&]sslmode=(require|verify-ca|verify-full)\b/i.test(connectionString) ||
    connectionString.includes('neon.tech')
  );
}

let pool: Pool | undefined;
let cached: Sql | undefined;

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: needsSsl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
  });
  return pool;
}

export function getSql(): Sql {
  cached ??= createSql(getPool());
  return cached;
}

/* Transacción explícita sobre una sola conexión (usar cuando varias
   queries deben confirmarse o revertirse juntas). */
export async function withTransaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(createSql(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
