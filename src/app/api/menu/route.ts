import { NextResponse } from 'next/server';
import { menuStore } from '@/lib/menu-store';
import { requireAccess } from '@/lib/access';

export async function GET() {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = access.restaurantId;

    const [categories, items, tags] = await Promise.all([
      menuStore.getCategories(userId),
      menuStore.getItems(userId),
      menuStore.getTags(userId),
    ]);

    return NextResponse.json({ categories, items, tags });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
