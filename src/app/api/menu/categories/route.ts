import { NextRequest, NextResponse } from 'next/server';
import { menuStore } from '@/lib/menu-store';
import { requireAdmin } from '@/lib/access';
import { revalidatePublicMenu } from '@/lib/menu-cache';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === 'string');
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = admin.restaurantId;

    const body = await request.json();
    const order: unknown = body?.order;
    if (!isStringArray(order)) {
      return NextResponse.json({ error: 'Orden de categorías inválido' }, { status: 400 });
    }

    const categories = await menuStore.getCategories(userId);
    const existingIds = new Set(categories.map((category) => category.id));
    const isComplete =
      order.length === categories.length &&
      new Set(order).size === order.length &&
      order.every((id) => existingIds.has(id));
    if (!isComplete) {
      return NextResponse.json({ error: 'Orden de categorías inválido' }, { status: 400 });
    }

    const updated = await menuStore.reorderCategories(userId, order);

    revalidatePublicMenu(userId);

    return NextResponse.json({ categories: updated });
  } catch {
    return NextResponse.json({ error: 'Failed to reorder categories' }, { status: 500 });
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
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }

    const categories = await menuStore.getCategories(userId);
    const order = body.order ?? categories.reduce((max, category) => Math.max(max, category.order), -1) + 1;
    const kind = body.kind === 'drink' ? 'drink' : 'food';

    const category = await menuStore.createCategory(userId, body.name, order, kind);

    revalidatePublicMenu(userId);

    return NextResponse.json({ category }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}