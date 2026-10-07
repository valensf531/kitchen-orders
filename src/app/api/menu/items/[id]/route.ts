import { NextRequest, NextResponse } from 'next/server';
import { menuStore } from '@/lib/menu-store';
import { requireAdmin } from '@/lib/access';
import { validateItemFields } from '@/lib/menu-validation';
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

    const fieldError = validateItemFields(body);
    if (fieldError) {
      return NextResponse.json({ error: fieldError }, { status: 400 });
    }

    const item = await menuStore.updateItem(id, userId, {
      name: body.name,
      price: body.price,
      categoryId: body.categoryId,
      available: body.available,
      imageUrl: body.imageUrl,
      description: body.description,
      ingredients: body.ingredients,
      tags: body.tags,
      featured: body.featured,
    });

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    revalidatePublicMenu(userId);

    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
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
    const deleted = await menuStore.deleteItem(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    revalidatePublicMenu(userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
