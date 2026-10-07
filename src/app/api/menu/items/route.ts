import { NextRequest, NextResponse } from 'next/server';
import { menuStore } from '@/lib/menu-store';
import { requireAdmin } from '@/lib/access';
import { validateItemFields } from '@/lib/menu-validation';
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

    if (typeof body.price !== 'number' || body.price < 0) {
      return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
    }

    if (!body.categoryId || typeof body.categoryId !== 'string') {
      return NextResponse.json({ error: 'Missing required field: categoryId' }, { status: 400 });
    }

    const fieldError = validateItemFields(body);
    if (fieldError) {
      return NextResponse.json({ error: fieldError }, { status: 400 });
    }

    const item = await menuStore.createItem(userId, {
      name: body.name,
      price: body.price,
      categoryId: body.categoryId,
      available: body.available ?? true,
      imageUrl: body.imageUrl,
      description: body.description || undefined,
      ingredients: body.ingredients || undefined,
      tags: Array.isArray(body.tags) ? body.tags : [],
      featured: body.featured ?? false,
    });

    revalidatePublicMenu(userId);

    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}