import { NextRequest, NextResponse } from 'next/server';
import { zoneStore, toZoneSlug } from '@/lib/zone-store';
import { tableStore } from '@/lib/table-store';
import { orderStore } from '@/lib/store';
import { requireAdmin } from '@/lib/access';
import { revalidatePublicMenu } from '@/lib/menu-cache';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = admin.restaurantId;

    const { id } = await params;
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    const slug = toZoneSlug(body.name);

    const zone = await zoneStore.update(id, userId, {
      name: body.name,
      slug,
    });

    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    revalidatePublicMenu(userId);

    return NextResponse.json({ zone });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Ya existe')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to update zone' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = admin.restaurantId;

    const { id } = await params;
    const zone = await zoneStore.getById(id, userId);
    if (!zone) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    const tables = await tableStore.getByZone(userId, zone.slug);
    for (const table of tables) {
      const hasOpen = await orderStore.hasOpenOrders(userId, {
        id: table.id,
        number: table.number,
        zone: table.zone,
      });
      if (hasOpen) {
        return NextResponse.json(
          {
            error: `La zona tiene cuentas abiertas (mesa ${table.number}). Cobralas o cancelalas antes de eliminarla.`,
          },
          { status: 409 },
        );
      }
    }

    const result = await zoneStore.delete(id, userId);

    if (!result.deleted) {
      return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
    }

    revalidatePublicMenu(userId);

    return NextResponse.json({ success: true, tablesDeleted: result.tablesDeleted });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete zone' },
      { status: 500 }
    );
  }
}
