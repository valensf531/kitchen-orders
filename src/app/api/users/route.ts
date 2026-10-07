import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access';
import { deleteStaffSessionsOnly, findByEmail, linkStaff, listStaff } from '@/lib/user-store';
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

    /* Alta contra el endpoint público de auth del MISMO origen con fetch
       server-side (sin cookies): el Set-Cookie de la sesión auto-creada
       queda en ESA respuesta y se descarta.
       NO llamar a signUpEmail por .api acá: el plugin nextCookies copiaría
       la cookie del vendor sobre la respuesta en curso y desloguearía al
       admin (su token muere al borrar las sesiones del vendor). */
    let createdId: string;
    try {
      const signUpUrl = new URL('/api/auth/sign-up/email', request.url);
      const signUpRes = await fetch(signUpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const signUpData = (await signUpRes.json().catch(() => null)) as {
        user?: { id?: unknown };
      } | null;
      const newId = signUpData?.user?.id;
      if (!signUpRes.ok || typeof newId !== 'string' || newId.length === 0) {
        logError('users.POST.signup', signUpData);
        return NextResponse.json({ error: 'No se pudo crear la cuenta (¿email ya registrado?)' }, { status: 400 });
      }
      createdId = newId;
    } catch (error) {
      logError('users.POST.signup', error);
      return NextResponse.json({ error: 'No se pudo crear la cuenta (¿email ya registrado?)' }, { status: 400 });
    }

    await linkStaff(createdId, admin.restaurantId, kind);
    await deleteStaffSessionsOnly(createdId);
    return NextResponse.json({ staff: { id: createdId, name, email, role: kind }, linked: false }, { status: 201 });
  } catch (error) {
    logError('users.POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
