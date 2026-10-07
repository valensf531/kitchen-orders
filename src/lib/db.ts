import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let cached: NeonQueryFunction<false, false> | undefined;

/* Cliente de Neon cacheado por proceso: evita recrearlo en cada request. */
export function getSql(): NeonQueryFunction<false, false> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  cached ??= neon(process.env.DATABASE_URL);
  return cached;
}
