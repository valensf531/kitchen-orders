import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access';
import { deleteStaff } from '@/lib/user-store';
import { setStaffRole, setStaffPassword } from '@/lib/user-store';
import { logError } from '@/lib/log';

const VALID_ROLES = ['staff', 'kitchen'] as const;
type StaffRole = (typeof VALID_ROLES)[number];

/* Actualiza rol o contraseña de un miembro del personal (solo admin). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Id inválido' }, { status: 400 });
    }

    const body = await request.json();

    if (body.role !== undefined) {
      if (!VALID_ROLES.includes(body.role)) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
      }
      const updated = await setStaffRole(id, admin.restaurantId, body.role as StaffRole);
      if (!updated) {
        return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });
      }
      return NextResponse.json({ success: true, role: body.role });
    }

    if (body.password !== undefined) {
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return NextResponse.json(
          { error: 'La contraseña debe tener al menos 8 caracteres' },
          { status: 400 },
        );
      }
      const updated = await setStaffPassword(id, admin.restaurantId, body.password);
      if (!updated) {
        return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });
      }
      /* Las sesiones abiertas del empleado dejan de ser válidas. */
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 });
  } catch (error) {
    logError('users/[id].PATCH', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
