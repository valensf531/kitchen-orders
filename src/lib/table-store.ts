import { getSql } from '@/lib/db';
import { Table, CreateTableInput, UpdateTableInput, TableStatus, ZoneType, TablePosition } from '@/types/table';

type TableRow = {
  id: string;
  number: number;
  zone: string;
  status: string;
  position_x: number | null;
  position_y: number | null;
  shape: string | null;
  seats: number | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
};

function mapRowToTable(row: TableRow): Table {
  return {
    id: row.id,
    number: Number(row.number),
    zone: row.zone as ZoneType,
    status: row.status as TableStatus,
    position: { 
      x: typeof row.position_x === 'number' && Number.isFinite(row.position_x) ? row.position_x : 100, 
      y: typeof row.position_y === 'number' && Number.isFinite(row.position_y) ? row.position_y : 100 
    },
    shape: (row.shape as 'circle' | 'square' | 'rectangle') ?? 'circle',
    seats: row.seats ?? 4,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class TableStore {
  async create(userId: string, input: CreateTableInput): Promise<Table> {
    const sql = getSql();
    
    const existing = await sql`
      SELECT * FROM tables WHERE number = ${input.number} AND zone = ${input.zone} AND user_id = ${userId}
    `;
    
    if (existing.length > 0) {
      throw new Error(`Ya existe una mesa con el número ${input.number} en esta zona`);
    }
    
    const id = `TBL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const position = input.position ?? { x: 150, y: 150 };
    const shape = input.shape ?? 'circle';
    const seats = input.seats ?? 4;
    
    await sql`
      INSERT INTO tables (id, number, zone, status, position_x, position_y, shape, seats, user_id, created_at, updated_at)
      VALUES (${id}, ${input.number}, ${input.zone}, 'available', ${position.x}, ${position.y}, ${shape}, ${seats}, ${userId}, ${now}, ${now})
    `;
    
    return {
      id,
      number: input.number,
      zone: input.zone,
      status: 'available',
      position,
      shape,
      seats,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getAll(userId: string): Promise<Table[]> {
    const sql = getSql();
    
    const rows = await sql`
      SELECT * FROM tables WHERE user_id = ${userId} ORDER BY zone, number
    `;
    
    return (rows as TableRow[]).map(mapRowToTable);
  }

  async getByZone(userId: string, zone: ZoneType): Promise<Table[]> {
    const sql = getSql();

    const rows = await sql`
      SELECT * FROM tables WHERE zone = ${zone} AND user_id = ${userId} ORDER BY number
    `;

    return (rows as TableRow[]).map(mapRowToTable);
  }

  /* Versión de las mesas (count + último update) para ETag/304 del polling. */
  async getVersion(userId: string): Promise<string> {
    const sql = getSql();

    const rows = await sql`
      SELECT count(*)::int AS count, COALESCE(max(updated_at)::text, '') AS last
      FROM tables WHERE user_id = ${userId}
    `;
    const row = rows[0] as { count: number; last: string };
    return `${row.count}-${row.last}`;
  }

  async getById(userId: string, id: string): Promise<Table | undefined> {
    const sql = getSql();
    
    const rows = await sql`
      SELECT * FROM tables WHERE id = ${id} AND user_id = ${userId}
    `;
    
    if (rows.length === 0) return undefined;
    return mapRowToTable(rows[0] as TableRow);
  }

  async update(userId: string, id: string, input: UpdateTableInput): Promise<Table | undefined> {
    const sql = getSql();
    
    const table = await this.getById(userId, id);
    if (!table) return undefined;
    
    if (input.number !== undefined && input.number !== table.number) {
      const existing = await sql`
        SELECT * FROM tables WHERE number = ${input.number} AND zone = ${table.zone} AND id != ${id} AND user_id = ${userId}
      `;
      
      if (existing.length > 0) {
        throw new Error(`Ya existe una mesa con el número ${input.number} en esta zona`);
      }
    }
    
    const now = new Date().toISOString();
    const newNumber = input.number ?? table.number;
    const newStatus = input.status ?? table.status;
    const newPosition = input.position ?? table.position;
    const newShape = input.shape ?? table.shape;
    const newSeats = input.seats ?? table.seats;
    
    await sql`
      UPDATE tables 
      SET number = ${newNumber}, 
          status = ${newStatus}, 
          position_x = ${newPosition.x}, 
          position_y = ${newPosition.y}, 
          shape = ${newShape}, 
          seats = ${newSeats},
          updated_at = ${now}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    
    return this.getById(userId, id);
  }

  async updatePosition(userId: string, id: string, position: TablePosition): Promise<Table | undefined> {
    const sql = getSql();
    
    const now = new Date().toISOString();
    
    await sql`
      UPDATE tables 
      SET position_x = ${position.x}, 
          position_y = ${position.y}, 
          updated_at = ${now}
      WHERE id = ${id} AND user_id = ${userId}
    `;
    
    return this.getById(userId, id);
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const sql = getSql();
    
    await sql`DELETE FROM tables WHERE id = ${id} AND user_id = ${userId}`;
    
    const checkTable = await this.getById(userId, id);
    return !checkTable;
  }

  async updateStatus(userId: string, id: string, status: TableStatus): Promise<Table | undefined> {
    return this.update(userId, id, { status });
  }
}

export const tableStore = new TableStore();
