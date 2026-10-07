/*
 * Rate limit en memoria por instancia (serverless). Detiene spam básico;
 * en producción conviene complementarlo con WAF (p. ej. Vercel Firewall)
 * o un store compartido (Upstash Redis) si el spam persiste.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let callsSinceCleanup = 0;

function purgeExpired(now: number) {
  for (const [bucketKey, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  callsSinceCleanup = 0;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAfterMs: number;
}

/* Chequea y consume un intento. `remaining` nunca baja de 0. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  /* Limpieza oportunista: por umbral o cada ~200 llamadas. */
  callsSinceCleanup += 1;
  if (buckets.size > 1000 || callsSinceCleanup >= 200) purgeExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAfterMs: windowMs };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    resetAfterMs: Math.max(0, bucket.resetAt - now),
  };
}

/* Devuelve true si el pedido entra dentro del límite (compatibilidad). */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  return checkRateLimit(key, limit, windowMs).allowed;
}
