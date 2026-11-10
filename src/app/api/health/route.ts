import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';

/* Salud real para Docker/Dokploy/monitoreo: app arriba y base respondiendo. */
export async function GET() {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString();
  try {
    const sql = getSql();
    await sql`SELECT 1`;
    return NextResponse.json(
      {
        status: 'ok',
        database: 'ok',
        latencyMs: Date.now() - startedAt,
        timestamp,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logError('health.GET', error);
    return NextResponse.json(
      {
        status: 'error',
        database: 'error',
        latencyMs: Date.now() - startedAt,
        timestamp,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
