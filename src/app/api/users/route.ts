import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access';
import { createUserWithPassword, findByEmail, linkStaff, listStaff } from '@/lib/user-store';
import { logError } from '@/lib/log';

function isEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/* Personal del restaurante (solo admin). */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const staff = await listStaff(admin.restaurantId);
    return NextResponse.json({ staff, role: admin.role });
  } catch (error) {
    logError('users.GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/* Crea o vincula una cuenta de personal (solo admin).
   - Email nuevo: crea la cuenta con la contraseña dada (sin tocar tu sesión).
   - Email existente: lo vincula como personal de tu restaurante.
   - kind: 'staff' (vendedor) o 'kitchen' (cocinero, solo ve cocina). */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const email = isEmail(body.email) ? body.email.trim().toLowerCase() : '';
    const kind: 'staff' | 'kitchen' = body.kind === 'kitchen' ? 'kitchen' : 'staff';

    if (!name) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    const existing = await findByEmail(email);
    if (existing) {
      if (existing.id === admin.userId) {
        return NextResponse.json({ error: 'Esa es tu propia cuenta' }, { status: 400 });
      }
      if (existing.ownerId === admin.restaurantId) {
        return NextResponse.json({ error: 'Esa cuenta ya es personal del restaurante' }, { status: 409 });
      }
      /* La cuenta pertenece a otro restaurante (dueño o personal ajeno):
         no se puede "robar" vinculándola acá. */
      if (existing.ownerId !== null || existing.role === 'admin') {
        return NextResponse.json({ error: 'Esa cuenta ya pertenece a otro restaurante' }, { status: 409 });
      }
      await linkStaff(existing.id, admin.restaurantId, kind);
      return NextResponse.json({ staff: { id: existing.id, name: existing.name, email: existing.email, role: kind }, linked: true });
    }

    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 8) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
    }

    /* Alta directa por SQL sin sesión: no toca la cookie del admin que
       da el alta (signUpEmail crearía sesión y nextCookies la copiaría
       sobre la respuesta, deslogueándolo). */
    let created: { id: string; name: string; email: string };
    try {
      created = await createUserWithPassword({
        name,
        email,
        password,
        role: kind,
        ownerId: admin.restaurantId,
      });
    } catch (error) {
      logError('users.POST.signup', error);
      const code = (error as { code?: string })?.code;
      if (code === '23505') {
        return NextResponse.json({ error: 'Ese email ya está registrado' }, { status: 409 });
      }
      return NextResponse.json({ error: 'No se pudo crear la cuenta' }, { status: 500 });
    }

    return NextResponse.json(
      { staff: { id: created.id, name: created.name, email: created.email, role: kind }, linked: false },
      { status: 201 },
    );
  } catch (error) {
    logError('users.POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
