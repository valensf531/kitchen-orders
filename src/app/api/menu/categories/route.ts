import { NextRequest, NextResponse } from 'next/server';
import { menuStore } from '@/lib/menu-store';
import { requireAdmin } from '@/lib/access';
import { revalidatePublicMenu } from '@/lib/menu-cache';

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = admin.restaurantId;

    const body = await request.json();
    
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    const categories = await menuStore.getCategories(userId);
    const order = body.order ?? categories.length;
    const kind = body.kind === 'drink' ? 'drink' : 'food';

    const category = await menuStore.createCategory(userId, body.name, order, kind);

    revalidatePublicMenu(userId);

    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}