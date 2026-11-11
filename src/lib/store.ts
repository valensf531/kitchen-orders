import { getSql } from '@/lib/db';
import { Order, CreateOrderInput, OrderStatus, OrderItem, PaymentMethod } from '@/types/order';

type OrderRow = {
  id: string;
  user_id: string;
  customer_name: string;
  table_number: number | null;
  items: OrderItem[];
  total: number | string;
  status: string;
  created_at: string;
  updated_at: string;
  processing_at: string | null;
  finished_at: string | null;
  paid_at: string | null;
  started_by: string | null;
  started_by_name: string | null;
  finished_by: string | null;
  finished_by_name: string | null;
  canceled_at: string | null;
  canceled_by: string | null;
  canceled_by_name: string | null;
  cancel_reason: string | null;
  source: string | null;
  notes: string | null;
  zone: string | null;
  table_id: string | null;
  display_number: number | null;
  client_order_id: string | null;
  payment_method: string | null;
  paid_by: string | null;
  paid_by_name: string | null;
  cash_session_id: string | null;
};

function mapRowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    userId: row.user_id,
    customerName: row.customer_name,
    tableNumber: row.table_number ?? undefined,
    tableId: row.table_id ?? undefined,
    displayNumber: row.display_number ?? undefined,
    clientOrderId: row.client_order_id ?? undefined,
    paymentMethod: (row.payment_method as Order['paymentMethod']) ?? undefined,
    paidBy: row.paid_by ?? undefined,
    paidByName: row.paid_by_name ?? undefined,
    cashSessionId: row.cash_session_id ?? undefined,
    items: row.items,
    total: typeof row.total === 'string' ? Number.parseFloat(row.total) || 0 : Number(row.total) || 0,
    status: row.status as OrderStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    processingAt: row.processing_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    paidAt: row.paid_at ?? undefined,
    startedBy: row.started_by ?? undefined,
    startedByName: row.started_by_name ?? undefined,
    finishedBy: row.finished_by ?? undefined,
    finishedByName: row.finished_by_name ?? undefined,
    canceledAt: row.canceled_at ?? undefined,
    canceledBy: row.canceled_by ?? undefined,
    canceledByName: row.canceled_by_name ?? undefined,
    cancelReason: row.cancel_reason ?? undefined,
    source: row.source ?? undefined,
    notes: row.notes ?? undefined,
    zone: row.zone ?? undefined,
  };
}

/* IDs legibles pero no secuenciales ni enumerables entre tenants.
   Los ORD-0001 históricos siguen válidos; solo cambia la generación nueva. */
export function buildOrderId(): string {
  const time = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0');
  return `ORD-${time}-${rand}`;
}

class OrderStore {
  private orderSchemaReady: Promise<void> | null = null;

  /* Compatibilidad: los despliegues nuevos deben correr `npm run migrate`
     (src/lib/schema.sql). Este ensure queda como red para BBDD antiguas y se
     puede desactivar con SKIP_AUTO_SCHEMA=1. Cacheado por proceso. */
  async ensureSchema() {
    if (process.env.SKIP_AUTO_SCHEMA === '1') return;
    if (!this.orderSchemaReady) {
      this.orderSchemaReady = (async () => {
        const sql = getSql();
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS started_by TEXT`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS started_by_name TEXT`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS finished_by TEXT`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS finished_by_name TEXT`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS canceled_by TEXT`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS canceled_by_name TEXT`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id VARCHAR(50)`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS display_number INTEGER`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_order_id VARCHAR(100)`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_by TEXT`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_by_name TEXT`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_session_id VARCHAR(50)`;
        await sql`CREATE SEQUENCE IF NOT EXISTS order_counter_seq AS BIGINT START 1`;
        await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_updated ON orders(user_id, updated_at DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_orders_user_paid ON orders(user_id, paid_at)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_orders_table_id ON orders(table_id)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_orders_cash_session ON orders(cash_session_id)`;
        await sql`
          UPDATE orders o
          SET table_id = t.id
          FROM tables t
          WHERE o.table_id IS NULL
            AND o.table_number IS NOT NULL
            AND t.number = o.table_number
            AND t.zone = o.zone
            AND t.user_id = o.user_id
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_user_client ON orders(user_id, client_order_id) WHERE client_order_id IS NOT NULL`;
        await sql`
          UPDATE orders o
          SET display_number = numbered.new_number
          FROM (
            SELECT id, nextval('order_counter_seq') AS new_number
            FROM orders
            WHERE display_number IS NULL
            ORDER BY created_at, id
          ) numbered
          WHERE o.id = numbered.id AND o.display_number IS NULL
        `;
        await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_display_number ON orders(display_number) WHERE display_number IS NOT NULL`;
      })().catch((error) => {
        this.orderSchemaReady = null;
        throw error;
      });
    }
    await this.orderSchemaReady;
  }

  async create(input: CreateOrderInput): Promise<Order> {
    const sql = getSql();
    await this.ensureSchema();

    const now = new Date().toISOString();
    const numberRows = await sql`SELECT nextval('order_counter_seq')::int AS display_number`;
    const displayNumber = Number((numberRows[0] as { display_number: number }).display_number);

    const order: Order = {
      id: '',
      userId: input.userId,
      customerName: input.customerName,
      tableNumber: input.tableNumber,
      tableId: input.tableId,
      displayNumber,
      clientOrderId: input.clientOrderId,
      items: input.items,
      total: input.total,
      status: 'received',
      createdAt: now,
      updatedAt: now,
      source: input.source,
      notes: input.notes,
      zone: input.zone,
    };

    // Reintento ante colisión improbable de id aleatorio (unique violation 23505).
    for (let attempt = 0; attempt < 3; attempt += 1) {
      order.id = buildOrderId();
      try {
        await sql`
          INSERT INTO orders (
            id, user_id, customer_name, table_number, table_id, display_number,
            client_order_id, items, total, status, created_at, updated_at,
            source, notes, zone
          ) VALUES (
            ${order.id}, ${order.userId}, ${order.customerName},
            ${order.tableNumber ?? null}, ${order.tableId ?? null}, ${order.displayNumber},
            ${order.clientOrderId ?? null}, ${JSON.stringify(order.items)}, ${order.total},
            ${order.status}, ${order.createdAt}, ${order.updatedAt},
            ${order.source ?? null}, ${order.notes ?? null}, ${order.zone ?? null}
          )
        `;
        return order;
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== '23505' || attempt === 2) throw error;
      }
    }

    throw new Error('No se pudo generar un id de orden único');
  }

  async getByClientOrderId(userId: string, clientOrderId: string): Promise<Order | undefined> {
    const sql = getSql();
    await this.ensureSchema();
    const rows = await sql`
      SELECT * FROM orders
      WHERE user_id = ${userId} AND client_order_id = ${clientOrderId}
      LIMIT 1
    `;
    if (rows.length === 0) return undefined;
    return mapRowToOrder(rows[0] as OrderRow);
  }

  /* activeOnly: solo lo que la operación necesita (activas + impagas + últimas 24h),
     para no arrastrar todo el histórico en cada polling de cocina/caja. */
  async getAll(userId: string, options: { activeOnly?: boolean } = {}): Promise<Order[]> {
    const sql = getSql();
    await this.ensureSchema();
    if (!userId) throw new Error('userId is required');

    let rows;    if (options.activeOnly) {
      rows = await sql`
        SELECT * FROM orders
        WHERE user_id = ${userId}
          AND (
            (status != 'canceled' AND (paid_at IS NULL OR created_at >= NOW() - INTERVAL '24 hours'))
            OR (status = 'canceled' AND created_at >= NOW() - INTERVAL '24 hours')
          )
        ORDER BY created_at DESC
      `;
    } else {
      rows = await sql`
        SELECT * FROM orders
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;
    }

    return (rows as OrderRow[]).map(mapRowToOrder);
  }

  /* Popularidad de platos: agregada en SQL (jsonb) sin traer las órdenes a memoria.
     Prioriza el id del plato (órdenes nuevas) con fallback por nombre (histórico). */
  async getItemCounts(userId: string): Promise<{
    byMenuItemId: Map<string, number>;
    byName: Map<string, number>;
  }> {
    const sql = getSql();
    await this.ensureSchema();

    const [idRows, nameRows] = await Promise.all([
      sql`
        SELECT elem->>'menuItemId' AS item_id,
               SUM(CASE WHEN (elem->>'quantity') ~ '^[0-9]+$' THEN (elem->>'quantity')::int ELSE 1 END) AS qty
        FROM orders, jsonb_array_elements(items) AS elem
        WHERE user_id = ${userId}
          AND status != 'canceled'
          AND jsonb_typeof(items) = 'array'
          AND elem->>'menuItemId' IS NOT NULL
        GROUP BY 1
      `,
      sql`
        SELECT lower(btrim(elem->>'name')) AS name,
               SUM(CASE WHEN (elem->>'quantity') ~ '^[0-9]+$' THEN (elem->>'quantity')::int ELSE 1 END) AS qty
        FROM orders, jsonb_array_elements(items) AS elem
        WHERE user_id = ${userId}
          AND status != 'canceled'
          AND jsonb_typeof(items) = 'array'
          AND elem->>'name' IS NOT NULL
        GROUP BY 1
      `,
    ]);

    const byMenuItemId = new Map<string, number>();
    for (const row of idRows as { item_id: string; qty: string | number }[]) {
      byMenuItemId.set(row.item_id, Math.max(0, Number(row.qty) || 0));
    }

    const byName = new Map<string, number>();
    for (const row of nameRows as { name: string; qty: string | number }[]) {
      byName.set(row.name, Math.max(0, Number(row.qty) || 0));
    }

    return { byMenuItemId, byName };
  }

  /* Versión de las órdenes (count + último update) para ETag/304 del polling. */
  async getVersion(userId: string): Promise<string> {
    const sql = getSql();
    await this.ensureSchema();
    const rows = await sql`
      SELECT count(*)::int AS count, COALESCE(max(updated_at)::text, '') AS last
      FROM orders WHERE user_id = ${userId}
    `;
    const row = rows[0] as { count: number; last: string };
    return `${row.count}-${row.last}`;
  }

  async getById(id: string, userId?: string): Promise<Order | undefined> {
    const sql = getSql();
    await this.ensureSchema();

    const rows =
      userId !== undefined
        ? await sql`
      SELECT * FROM orders WHERE id = ${id} AND user_id = ${userId}
    `
        : await sql`
      SELECT * FROM orders WHERE id = ${id}
    `;

    if (rows.length === 0) return undefined;
    return mapRowToOrder(rows[0] as OrderRow);
  }

  async updateStatus(
    id: string,
    status: OrderStatus,
    userId?: string,
    actor?: { id: string; name: string | null },
    reason?: string,
  ): Promise<Order | undefined> {
    const sql = getSql();
    await this.ensureSchema();

    const order = await this.getById(id, userId);
    if (!order) return undefined;

    const now = new Date().toISOString();

    let processingAt = order.processingAt ?? null;
    let finishedAt = order.finishedAt ?? null;
    let startedBy = order.startedBy ?? null;
    let startedByName = order.startedByName ?? null;
    let finishedBy = order.finishedBy ?? null;
    let finishedByName = order.finishedByName ?? null;
    let canceledAt = order.canceledAt ?? null;
    let canceledBy = order.canceledBy ?? null;
    let canceledByName = order.canceledByName ?? null;
    let cancelReason = order.cancelReason ?? null;

    if (status === 'processing' && !processingAt) {
      processingAt = now;
      if (actor) {
        startedBy = actor.id;
        startedByName = actor.name;
      }
    }
    if (status === 'finished' && !finishedAt) {
      finishedAt = now;
      if (actor) {
        finishedBy = actor.id;
        finishedByName = actor.name;
      }
    }
    if (status === 'canceled' && !canceledAt) {
      canceledAt = now;
      if (actor) {
        canceledBy = actor.id;
        canceledByName = actor.name;
      }
      cancelReason = reason?.trim().slice(0, 300) || null;
    }

    const rows =
      userId !== undefined
        ? await sql`
      UPDATE orders
      SET status = ${status},
          updated_at = ${now},
          processing_at = ${processingAt},
          finished_at = ${finishedAt},
          started_by = ${startedBy},
          started_by_name = ${startedByName},
          finished_by = ${finishedBy},
          finished_by_name = ${finishedByName},
          canceled_at = ${canceledAt},
          canceled_by = ${canceledBy},
          canceled_by_name = ${canceledByName},
          cancel_reason = ${cancelReason}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `
        : await sql`
      UPDATE orders
      SET status = ${status},
          updated_at = ${now},
          processing_at = ${processingAt},
          finished_at = ${finishedAt},
          started_by = ${startedBy},
          started_by_name = ${startedByName},
          finished_by = ${finishedBy},
          finished_by_name = ${finishedByName},
          canceled_at = ${canceledAt},
          canceled_by = ${canceledBy},
          canceled_by_name = ${canceledByName},
          cancel_reason = ${cancelReason}
      WHERE id = ${id}
      RETURNING *
    `;

    return rows.length > 0 ? mapRowToOrder(rows[0] as OrderRow) : undefined;
  }

  async markOrderPaid(
    id: string,
    userId: string,
    options: {
      paymentMethod?: PaymentMethod;
      paidBy?: string | null;
      paidByName?: string | null;
      cashSessionId?: string | null;
    },
  ): Promise<Order | undefined> {
    const sql = getSql();
    await this.ensureSchema();
    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE orders
      SET paid_at = ${now}, updated_at = ${now},
          payment_method = ${options.paymentMethod ?? null},
          paid_by = ${options.paidBy ?? null},
          paid_by_name = ${options.paidByName ?? null},
          cash_session_id = ${options.cashSessionId ?? null}
      WHERE id = ${id} AND user_id = ${userId}
        AND status != 'canceled' AND paid_at IS NULL
      RETURNING *
    `;
    if (rows.length > 0) return mapRowToOrder(rows[0] as OrderRow);

    const existing = await this.getById(id, userId);
    return existing?.paidAt ? existing : undefined;
  }

  async updateItemDelivery(
    id: string,
    itemIndex: number,
    delivered: boolean,
    userId?: string,
  ): Promise<Order | undefined> {
    const sql = getSql();
    await this.ensureSchema();

    const order = await this.getById(id, userId);
    if (!order || !order.items[itemIndex]) return undefined;
    
    const updatedItems = order.items.map((item, idx) =>
      idx === itemIndex ? { ...item, delivered } : item
    );
    
    const now = new Date().toISOString();

    const rows =
      userId !== undefined
        ? await sql`
      UPDATE orders
      SET items = ${JSON.stringify(updatedItems)},
          updated_at = ${now}
      WHERE id = ${id} AND user_id = ${userId}
      RETURNING *
    `
        : await sql`
      UPDATE orders
      SET items = ${JSON.stringify(updatedItems)},
          updated_at = ${now}
      WHERE id = ${id}
      RETURNING *
    `;

    return rows.length > 0 ? mapRowToOrder(rows[0] as OrderRow) : undefined;
  }

  async closeTableAccount(
    userId: string,
    tableNumber: number,
    zone?: string,
    options: {
      tableId?: string;
      paymentMethod?: PaymentMethod;
      paidBy?: string | null;
      paidByName?: string | null;
      cashSessionId?: string | null;
    } = {},
  ): Promise<number> {
    const sql = getSql();
    await this.ensureSchema();
    const now = new Date().toISOString();
    const paymentMethod = options.paymentMethod ?? null;
    const paidBy = options.paidBy ?? null;
    const paidByName = options.paidByName ?? null;
    const cashSessionId = options.cashSessionId ?? null;

    if (options.tableId) {
      const rows = await sql`
        UPDATE orders
        SET paid_at = ${now}, updated_at = ${now},
            payment_method = ${paymentMethod},
            paid_by = ${paidBy}, paid_by_name = ${paidByName},
            cash_session_id = ${cashSessionId}
        WHERE user_id = ${userId} AND table_id = ${options.tableId}
          AND status != 'canceled' AND paid_at IS NULL
        RETURNING id
      `;
      return rows.length;
    }

    if (zone) {
      const rows = await sql`
        UPDATE orders
        SET paid_at = ${now}, updated_at = ${now},
            payment_method = ${paymentMethod},
            paid_by = ${paidBy}, paid_by_name = ${paidByName},
            cash_session_id = ${cashSessionId}
        WHERE user_id = ${userId} AND table_number = ${tableNumber} AND zone = ${zone}
          AND status != 'canceled' AND paid_at IS NULL
        RETURNING id
      `;
      return rows.length;
    }

    const rows = await sql`
      UPDATE orders
      SET paid_at = ${now}, updated_at = ${now},
          payment_method = ${paymentMethod},
          paid_by = ${paidBy}, paid_by_name = ${paidByName},
          cash_session_id = ${cashSessionId}
      WHERE user_id = ${userId} AND table_number = ${tableNumber}
        AND status != 'canceled' AND paid_at IS NULL
      RETURNING id
    `;
    return rows.length;
  }

  /* ¿Queda alguna cuenta abierta (no cancelada, sin cobrar) para la mesa? */
  async hasOpenOrders(
    userId: string,
    table: { id?: string; number: number; zone?: string | null },
  ): Promise<boolean> {
    const sql = getSql();
    await this.ensureSchema();

    if (table.id) {
      const targetZone = table.zone ?? null;
      const rows = await sql`
        SELECT 1 FROM orders
        WHERE user_id = ${userId}
          AND status != 'canceled'
          AND paid_at IS NULL
          AND (
            table_id = ${table.id}
            OR (
              table_id IS NULL
              AND table_number = ${table.number}
              AND (${targetZone}::text IS NULL OR zone = ${targetZone} OR zone IS NULL)
            )
          )
        LIMIT 1
      `;
      return rows.length > 0;
    }

    const targetZone = table.zone ?? null;
    const rows = await sql`
      SELECT 1 FROM orders
      WHERE user_id = ${userId}
        AND table_number = ${table.number}
        AND status != 'canceled'
        AND paid_at IS NULL
        AND (${targetZone}::text IS NULL OR zone = ${targetZone} OR zone IS NULL)
      LIMIT 1
    `;
    return rows.length > 0;
  }
}

export const orderStore = new OrderStore();
