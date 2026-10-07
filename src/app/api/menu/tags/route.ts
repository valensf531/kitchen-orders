import { NextRequest, NextResponse } from 'next/server';
import { menuStore } from '@/lib/menu-store';
import { requireAccess, requireAdmin } from '@/lib/access';
import { validateTagBody } from '@/lib/menu-tags';
import { revalidatePublicMenu } from '@/lib/menu-cache';

export async function GET() {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = access.restaurantId;

    const tags = await menuStore.getTags(userId);
    return NextResponse.json({ tags });
  } catch {
    return NextResponse.json({ error: 'Failed to load tags' }, { status: 500 });
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
    const errors = validateTagBody(body);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const tag = await menuStore.createTag(userId, {
      label: String(body.label).trim(),
      icon: typeof body.icon === 'string' && body.icon.trim() ? body.icon.trim() : undefined,
      tone: typeof body.tone === 'string' ? body.tone : undefined,
    });

    revalidatePublicMenu(userId);

    return NextResponse.json({ tag }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
  }
}
