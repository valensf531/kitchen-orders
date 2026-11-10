import { NextRequest, NextResponse } from 'next/server';
import { requireAccess } from '@/lib/access';
import { canOperateTables } from '@/lib/permissions';
import { cashSessionStore } from '@/lib/cash-session-store';
import { logError } from '@/lib/log';

const EMPTY_SUMMARY = {
  orders: 0,
  total: 0,
  cashTotal: 0,
  cardTotal: 0,
  transferTotal: 0,
  otherTotal: 0,
};

export async function GET() {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canOperateTables(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const session = await cashSessionStore.getOpen(access.restaurantId);
    const summary = session
      ? await cashSessionStore.getSummary(access.restaurantId, session.id)
      : EMPTY_SUMMARY;

    return NextResponse.json({ session, summary });
  } catch (error) {
    logError('cash-sessions.GET', error);
    return NextResponse.json({ error: 'No se pudo cargar la caja' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canOperateTables(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (action !== 'open' && action !== 'close') {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }

    const actor = { id: access.userId, name: access.name };

    if (action === 'open') {
      const openingAmount = Number(body.openingAmount ?? 0);
      if (!Number.isFinite(openingAmount) || openingAmount < 0) {
        return NextResponse.json({ error: 'Monto inicial inválido' }, { status: 400 });
      }
      const session = await cashSessionStore.open(access.restaurantId, actor, openingAmount);
      const summary = await cashSessionStore.getSummary(access.restaurantId, session.id);
      return NextResponse.json({ session, summary });
    }

    const closingAmount = Number(body.closingAmount);
    if (!Number.isFinite(closingAmount) || closingAmount < 0) {
      return NextResponse.json({ error: 'Monto de cierre inválido' }, { status: 400 });
    }
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 300) : undefined;
    const result = await cashSessionStore.close(
      access.restaurantId,
      actor,
      closingAmount,
      notes,
    );
    if (!result) {
      return NextResponse.json({ error: 'No hay una caja abierta' }, { status: 409 });
    }

    return NextResponse.json({ session: result.session, summary: result.summary });
  } catch (error) {
    logError('cash-sessions.POST', error);
    return NextResponse.json({ error: 'No se pudo actualizar la caja' }, { status: 500 });
  }
}
