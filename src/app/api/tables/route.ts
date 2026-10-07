import { NextRequest, NextResponse } from 'next/server';
import { tableStore } from '@/lib/table-store';
import { ZoneType, CreateTableInput } from '@/types/table';
import { requireAccess, requireAdmin } from '@/lib/access';
import { revalidatePublicMenu } from '@/lib/menu-cache';

export async function GET(request: NextRequest) {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = access.restaurantId;

    const { searchParams } = new URL(request.url);
    const zone = searchParams.get('zone') as ZoneType | null;

    /* ETag: el polling responde 304 (cuerpo vacío) si nada cambió. */
    const etag = `"tables-${zone ?? 'all'}-${await tableStore.getVersion(userId)}"`;
    if (request.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    const tables = zone
      ? await tableStore.getByZone(userId, zone)
      : await tableStore.getAll(userId);

    return NextResponse.json(
      { tables },
      {
        headers: {
          ETag: etag,
          'Cache-Control': 'private, max-age=0, must-revalidate',
        },
      },
    );
  } catch (error) {
    console.error('Failed to fetch tables:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tables' },
      { status: 500 }
    );
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
    const { number, zone, shape, seats, position } = body;
    
    if (!number || !zone) {
      return NextResponse.json(
        { error: 'Number and zone are required' },
        { status: 400 }
      );
    }
    
    const input: CreateTableInput = {
      number,
      zone: zone as ZoneType,
      shape,
      seats,
      position,
    };
    
    const table = await tableStore.create(userId, input);

    revalidatePublicMenu(userId);

    return NextResponse.json({ table }, { status: 201 });
  } catch (error) {
    console.error('Failed to create table:', error);
    if (error instanceof Error && error.message.includes('Ya existe')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create table' },
      { status: 500 }
    );
  }
}
