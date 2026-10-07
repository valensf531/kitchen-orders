import { getSql } from '@/lib/db';

export interface Zone {
  id: string;
  userId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

type ZoneRow = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

function mapRowToZone(row: ZoneRow): Zone {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* Slug de zona a partir del nombre: minúsculas, sin acentos, espacios a
   "_". Nombres similares ("Terraza", "terraza", "Terraza!") colisionan en
   el mismo slug: por eso las mesas cuelgan del slug y hay que borrarlas o
   migrarlas junto con la zona (si no, "reviven" al recrearla). */
export function toZoneSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');
}

class ZoneStore {
  async create(userId: string, input: { name: string; slug: string }): Promise<Zone> {
    const sql = getSql();
    
    const existing = await sql`
      SELECT * FROM zones WHERE slug = ${input.slug} AND user_id = ${userId}
    `;
    
    if (existing.length > 0) {
      throw new Error(`Ya existe una zona con el slug ${input.slug}`);
    }
    
    const id = `ZONE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    await sql`
      INSERT INTO zones (id, user_id, name, slug, created_at, updated_at)
      VALUES (${id}, ${userId}, ${input.name}, ${input.slug}, ${now}, ${now})
    `;
    
    return {
      id,
      userId,
      name: input.name,
      slug: input.slug,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getByUserId(userId: string): Promise<Zone[]> {
    const sql = getSql();
    
    const rows = await sql`
      SELECT * FROM zones WHERE user_id = ${userId} ORDER BY created_at ASC
    `;
    
    return (rows as ZoneRow[]).map(mapRowToZone);
  }

  async getById(id: string, userId?: string): Promise<Zone | undefined> {
    const sql = getSql();

    const rows =
      userId !== undefined
        ? await sql`
      SELECT * FROM zones WHERE id = ${id} AND user_id = ${userId}
    `
        : await sql`
      SELECT * FROM zones WHERE id = ${id}
    `;

    if (rows.length === 0) return undefined;
    return mapRowToZone(rows[0] as ZoneRow);
  }

  async update(id: string, userId: string, input: { name: string; slug: string }): Promise<Zone | undefined> {
    const sql = getSql();

    const zone = await this.getById(id, userId);
    if (!zone) return undefined;
    
    if (input.slug !== zone.slug) {
      const existing = await sql`
        SELECT * FROM zones WHERE slug = ${input.slug} AND user_id = ${userId} AND id != ${id}
      `;
      
      if (existing.length > 0) {
        throw new Error(`Ya existe una zona con el slug ${input.slug}`);
      }
    }
    
    const now = new Date().toISOString();
    const slugChanged = input.slug !== zone.slug;

    await sql`
      UPDATE zones
      SET name = ${input.name},
          slug = ${input.slug},
          updated_at = ${now}
      WHERE id = ${id} AND user_id = ${userId}
    `;

    /* Renombrar cambia el slug: las mesas cuelgan del slug, así que hay
       que migrarlas o quedarían huérfanas (invisibles hasta recrear la zona). */
    if (slugChanged) {
      await sql`
        UPDATE tables
        SET zone = ${input.slug},
            updated_at = ${now}
        WHERE zone = ${zone.slug} AND user_id = ${userId}
      `;
    }

    return this.getById(id, userId);
  }

  /* Borra la zona y sus mesas en cascada. Devuelve cuántas mesas eliminó:
     sin esto quedaban huérfanas y "reaparecían" al crear una zona con un
     nombre similar (mismo slug). Los pedidos históricos no se tocan. */
  async delete(id: string, userId: string): Promise<{ deleted: boolean; tablesDeleted: number }> {
    const sql = getSql();

    const zone = await this.getById(id, userId);
    if (!zone) return { deleted: false, tablesDeleted: 0 };

    const tables = await sql`
      DELETE FROM tables WHERE zone = ${zone.slug} AND user_id = ${userId} RETURNING id
    `;

    await sql`DELETE FROM zones WHERE id = ${id} AND user_id = ${userId}`;

    const checkZone = await this.getById(id, userId);
    if (!checkZone) return { deleted: true, tablesDeleted: tables.length };
    return { deleted: false, tablesDeleted: 0 };
  }
}

export const zoneStore = new ZoneStore();
