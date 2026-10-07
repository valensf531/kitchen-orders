import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access';
import { deleteStaff } from '@/lib/user-store';
import { logError } from '@/lib/log';

/* Quita el acceso a un miembro del personal (solo admin). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!id || id === admin.userId) {
      return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
    }
    const removed = await deleteStaff(id, admin.restaurantId);
    if (!removed) {
      return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('users/[id].DELETE', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
