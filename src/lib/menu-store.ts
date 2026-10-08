import { getSql } from '@/lib/db';
import { normalizeTone } from '@/lib/menu-tags';

export type MenuCategoryKind = 'food' | 'drink';

export interface MenuCategory {
  id: string;
  userId: string;
  name: string;
  order: number;
  kind: MenuCategoryKind;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItem {
  id: string;
  userId: string;
  name: string;
  price: number;
  categoryId: string;
  available: boolean;
  imageUrl?: string;
  description?: string;
  ingredients?: string;
  tags: string[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCustomTag {
  id: string;
  userId: string;
  label: string;
  icon?: string;
  tone?: string;
  createdAt: string;
}

export interface MenuItemInput {
  name: string;
  price: number;
  categoryId: string;
  available?: boolean;
  imageUrl?: string;
  description?: string;
  ingredients?: string;
  tags?: string[];
  featured?: boolean;
}

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  order: number;
  kind: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  user_id: string;
  name: string;
  price: string | number;
  category_id: string;
  available: boolean;
  image_url: string | null;
  description: string | null;
  ingredients: string | null;
  tags: string | null;
  featured: boolean | null;
  created_at: string;
  updated_at: string;
};

type TagRow = {
  id: string;
  user_id: string;
  label: string;
  icon: string | null;
  tone: string | null;
  created_at: string;
};

function parseTags(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((tag) => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

function mapRowToCategory(row: CategoryRow): MenuCategory {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    order: row.order,
    kind: row.kind === 'drink' ? 'drink' : 'food',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToItem(row: ItemRow): MenuItem {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    price: typeof row.price === 'string' ? parseFloat(row.price) : row.price,
    categoryId: row.category_id,
    available: row.available,
    imageUrl: row.image_url ?? undefined,
    description: row.description ?? undefined,
    ingredients: row.ingredients ?? undefined,
    tags: parseTags(row.tags),
    featured: Boolean(row.featured),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToTag(row: TagRow): MenuCustomTag {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    icon: row.icon ?? undefined,
    tone: normalizeTone(row.tone),
    createdAt: row.created_at,
  };
}

class MenuStore {
  private menuColumnsReady: Promise<void> | null = null;

  /* Compatibilidad: preferir `npm run migrate`. Red para BBDD antiguas;
     desactivable con SKIP_AUTO_SCHEMA=1. Cacheado por proceso. */
  private async ensureMenuColumns() {
    if (process.env.SKIP_AUTO_SCHEMA === '1') return;
    if (!this.menuColumnsReady) {
      this.menuColumnsReady = (async () => {
        const sql = getSql();
        await sql`
          ALTER TABLE menu_items
          ADD COLUMN IF NOT EXISTS image_url TEXT,
          ADD COLUMN IF NOT EXISTS description TEXT,
          ADD COLUMN IF NOT EXISTS ingredients TEXT,
          ADD COLUMN IF NOT EXISTS tags TEXT,
          ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false
        `;
        await sql`
          CREATE TABLE IF NOT EXISTS menu_tags (
            id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            label VARCHAR(50) NOT NULL,
            icon VARCHAR(10),
            tone VARCHAR(20),
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_menu_tags_user_id ON menu_tags(user_id)`;
        await sql`ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'food'`;
      })().catch((error) => {
        this.menuColumnsReady = null;
        throw error;
      });
    }
    await this.menuColumnsReady;
  }

  async getPublicRestaurantId(): Promise<string | undefined> {
    const sql = getSql();
    const rows = await sql`SELECT user_id FROM menu_categories ORDER BY created_at ASC LIMIT 1`;
    return rows.length > 0 ? String(rows[0].user_id) : undefined;
  }

  async getCategories(userId: string): Promise<MenuCategory[]> {
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM menu_categories WHERE user_id = ${userId} ORDER BY "order" ASC
    `;
    return (rows as CategoryRow[]).map(mapRowToCategory);
  }

  async getItems(userId: string): Promise<MenuItem[]> {
    const sql = getSql();
    await this.ensureMenuColumns();
    const rows = await sql`
      SELECT * FROM menu_items WHERE user_id = ${userId} ORDER BY created_at ASC
    `;
    return (rows as ItemRow[]).map(mapRowToItem);
  }

  async getTags(userId: string): Promise<MenuCustomTag[]> {
    const sql = getSql();
    await this.ensureMenuColumns();
    const rows = await sql`
      SELECT * FROM menu_tags WHERE user_id = ${userId} ORDER BY created_at ASC
    `;
    return (rows as TagRow[]).map(mapRowToTag);
  }

  /* Foto de un plato (data URL o URL externa) para la ruta pública de imágenes. */
  async getItemImage(id: string, expectedUserId?: string): Promise<string | undefined> {
    const sql = getSql();
    await this.ensureMenuColumns();
    if (!/^ITEM-[A-Za-z0-9-]+$/.test(id)) return undefined;
    const rows =
      expectedUserId !== undefined
        ? await sql`
      SELECT image_url FROM menu_items WHERE id = ${id} AND user_id = ${expectedUserId}
    `
        : await sql`
      SELECT image_url FROM menu_items WHERE id = ${id}
    `;
    const value = (rows[0] as { image_url?: string | null } | undefined)?.image_url;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  async createCategory(
    userId: string,
    name: string,
    order: number,
    kind: MenuCategoryKind = 'food',
  ): Promise<MenuCategory> {
    const sql = getSql();
    const id = `CAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await sql`
      INSERT INTO menu_categories (id, user_id, name, "order", kind, created_at, updated_at)
      VALUES (${id}, ${userId}, ${name}, ${order}, ${kind}, ${now}, ${now})
    `;

    return {
      id,
      userId,
      name,
      order,
      kind,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateCategory(
    id: string,
    userId: string,
    name: string,
    kind?: MenuCategoryKind,
  ): Promise<MenuCategory | undefined> {
    const sql = getSql();
    const now = new Date().toISOString();

    const result =
      kind === undefined
        ? await sql`
      UPDATE menu_categories
      SET name = ${name}, updated_at = ${now}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `
        : await sql`
      UPDATE menu_categories
      SET name = ${name}, kind = ${kind}, updated_at = ${now}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    if (result.length === 0) return undefined;
    return mapRowToCategory(result[0] as CategoryRow);
  }

  async deleteCategory(id: string, userId: string): Promise<boolean> {
    const sql = getSql();

    await sql`DELETE FROM menu_items WHERE category_id = ${id} AND user_id = ${userId}`;
    const deleted =
      await sql`DELETE FROM menu_categories WHERE id = ${id} AND user_id = ${userId} RETURNING id`;

    return deleted.length > 0;
  }

  async createItem(userId: string, data: MenuItemInput): Promise<MenuItem> {
    const sql = getSql();
    await this.ensureMenuColumns();
    const id = `ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const available = data.available ?? true;
    const tags = Array.isArray(data.tags) ? data.tags : [];

    await sql`
      INSERT INTO menu_items (id, user_id, name, price, category_id, available, image_url, description, ingredients, tags, featured, created_at, updated_at)
      VALUES (
        ${id}, ${userId}, ${data.name}, ${data.price}, ${data.categoryId}, ${available},
        ${data.imageUrl ?? null}, ${data.description ?? null}, ${data.ingredients ?? null},
        ${JSON.stringify(tags)}, ${data.featured ?? false}, ${now}, ${now}
      )
    `;

    return {
      id,
      userId,
      name: data.name,
      price: data.price,
      categoryId: data.categoryId,
      available,
      imageUrl: data.imageUrl,
      description: data.description,
      tags,
      featured: data.featured ?? false,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateItem(id: string, userId: string, data: Partial<MenuItemInput>): Promise<MenuItem | undefined> {
    const sql = getSql();
    await this.ensureMenuColumns();
    const now = new Date().toISOString();

    const existing = await sql`
      SELECT * FROM menu_items WHERE id = ${id} AND user_id = ${userId}
    `;
    
    if (existing.length === 0) return undefined;
    
    const current = existing[0] as ItemRow;
    const nextTags = data.tags !== undefined ? data.tags : parseTags(current.tags);

    await sql`
      UPDATE menu_items 
      SET name = ${data.name ?? current.name}, 
          price = ${data.price ?? current.price}, 
          category_id = ${data.categoryId ?? current.category_id}, 
          available = ${data.available ?? current.available},
          image_url = ${data.imageUrl !== undefined ? data.imageUrl : current.image_url},
          description = ${data.description !== undefined ? data.description : current.description},
          ingredients = ${data.ingredients !== undefined ? data.ingredients : current.ingredients},
          tags = ${JSON.stringify(nextTags)},
          featured = ${data.featured !== undefined ? data.featured : Boolean(current.featured)},
          updated_at = ${now}
      WHERE id = ${id} AND user_id = ${userId}
    `;

    const result = await sql`SELECT * FROM menu_items WHERE id = ${id} AND user_id = ${userId}`;
    if (result.length === 0) return undefined;
    return mapRowToItem(result[0] as ItemRow);
  }

  async deleteItem(id: string, userId: string): Promise<boolean> {
    const sql = getSql();
    const deleted =
      await sql`DELETE FROM menu_items WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
    return deleted.length > 0;
  }

  async createTag(userId: string, data: { label: string; icon?: string; tone?: string }): Promise<MenuCustomTag> {
    const sql = getSql();
    await this.ensureMenuColumns();
    const id = `TAG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const tone = data.tone ? normalizeTone(data.tone) : undefined;
    const now = new Date().toISOString();

    await sql`
      INSERT INTO menu_tags (id, user_id, label, icon, tone, created_at)
      VALUES (${id}, ${userId}, ${data.label}, ${data.icon ?? null}, ${tone ?? null}, ${now})
    `;

    return {
      id,
      userId,
      label: data.label,
      icon: data.icon,
      tone,
      createdAt: now,
    };
  }

  async updateTag(id: string, userId: string, data: { label?: string; icon?: string; tone?: string }): Promise<MenuCustomTag | undefined> {
    const sql = getSql();
    await this.ensureMenuColumns();

    const existing = await sql`SELECT * FROM menu_tags WHERE id = ${id} AND user_id = ${userId}`;
    if (existing.length === 0) return undefined;
    const current = existing[0] as TagRow;

    const label = data.label ?? current.label;
    const icon = data.icon !== undefined ? data.icon : current.icon ?? undefined;
    const tone = data.tone !== undefined ? normalizeTone(data.tone) : normalizeTone(current.tone);

    const result = await sql`
      UPDATE menu_tags
      SET label = ${label}, icon = ${icon ?? null}, tone = ${tone}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `;

    return mapRowToTag(result[0] as TagRow);
  }

  async deleteTag(id: string, userId: string): Promise<boolean> {
    const sql = getSql();
    await this.ensureMenuColumns();

    const deleted =
      await sql`DELETE FROM menu_tags WHERE id = ${id} AND user_id = ${userId} RETURNING id`;
    if (deleted.length === 0) return false;

    /* Quitar la etiqueta de todos los items que la usan. */
    const items = await this.getItems(userId);
    for (const item of items.filter((item) => item.tags.includes(id))) {
      await this.updateItem(item.id, userId, { tags: item.tags.filter((tag) => tag !== id) });
    }

    return true;
  }
}

export const menuStore = new MenuStore();
