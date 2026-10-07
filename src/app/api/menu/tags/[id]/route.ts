import { NextRequest, NextResponse } from 'next/server';
import { menuStore } from '@/lib/menu-store';
import { requireAdmin } from '@/lib/access';
import { validateTagBody } from '@/lib/menu-tags';
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
    const errors = validateTagBody(body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const tag = await menuStore.updateTag(id, userId, {
      label: typeof body.label === 'string' ? body.label.trim() : undefined,
      icon: typeof body.icon === 'string' ? body.icon.trim() : undefined,
      tone: typeof body.tone === 'string' ? body.tone : undefined,
    });

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    revalidatePublicMenu(userId);

    return NextResponse.json({ tag });
  } catch {
    return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 });
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
    const deleted = await menuStore.deleteTag(id, userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    revalidatePublicMenu(userId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
  }
}
