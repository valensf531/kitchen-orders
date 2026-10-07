import { NextResponse } from 'next/server';
import { requireAccess } from '@/lib/access';
import { logError } from '@/lib/log';

/* Contexto de acceso del usuario actual: quién sos, sobre qué restaurante
   operás y con qué rol. Lo usa la UI (QRs, pestañas por rol). */
export async function GET() {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({
      userId: access.userId,
      restaurantId: access.restaurantId,
      role: access.role,
      isAdmin: access.isAdmin,
    });
  } catch (error) {
    logError('access.GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
