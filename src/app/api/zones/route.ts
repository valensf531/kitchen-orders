import { NextRequest, NextResponse } from 'next/server';
import { zoneStore, toZoneSlug } from '@/lib/zone-store';
import { requireAccess, requireAdmin } from '@/lib/access';

export async function GET() {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = access.restaurantId;
    const zones = await zoneStore.getByUserId(userId);
    return NextResponse.json({ zones });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = admin.restaurantId;

    const body = await request.json();
    
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    const slug = toZoneSlug(body.name);

    const zone = await zoneStore.create(userId, {
      name: body.name,
      slug,
    });

    return NextResponse.json({ zone }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Ya existe')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to create zone' },
      { status: 500 }
    );
  }
}
