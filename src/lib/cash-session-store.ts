import { getSql } from '@/lib/db';

export type CashSessionStatus = 'open' | 'closed';

export interface CashSession {
  id: string;
  userId: string;
  status: CashSessionStatus;
  openedBy: string | null;
  openedByName: string | null;
  openedAt: string;
  openingAmount: number;
  closedBy: string | null;
  closedByName: string | null;
  closedAt: string | null;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  notes: string | null;
}

export interface CashSessionSummary {
  orders: number;
  total: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  otherTotal: number;
  mercadopagoTotal: number;
}

type CashSessionRow = {
  id: string;
  user_id: string;
  status: string;
  opened_by: string | null;
  opened_by_name: string | null;
  opened_at: string;
  opening_amount: string | number;
  closed_by: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
  closing_amount: string | number | null;
  expected_amount: string | number | null;
  difference: string | number | null;
  notes: string | null;
};

const amount = (value: string | number | null): number =>
  value === null ? 0 : Number.parseFloat(String(value)) || 0;

function mapRow(row: CashSessionRow): CashSession {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status === 'closed' ? 'closed' : 'open',
    openedBy: row.opened_by,
    openedByName: row.opened_by_name,
    openedAt: row.opened_at,
    openingAmount: amount(row.opening_amount),
    closedBy: row.closed_by,
    closedByName: row.closed_by_name,
    closedAt: row.closed_at,
    closingAmount: row.closing_amount === null ? null : amount(row.closing_amount),
    expectedAmount: row.expected_amount === null ? null : amount(row.expected_amount),
    difference: row.difference === null ? null : amount(row.difference),
    notes: row.notes,
  };
}

class CashSessionStore {
  private ready: Promise<void> | null = null;

  private async ensureSchema() {
    if (process.env.SKIP_AUTO_SCHEMA === '1') return;
    if (!this.ready) {
      this.ready = (async () => {
        const sql = getSql();
        await sql`
          CREATE TABLE IF NOT EXISTS cash_sessions (
            id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            opened_by TEXT,
            opened_by_name TEXT,
            opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            opening_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
            closed_by TEXT,
            closed_by_name TEXT,
            closed_at TIMESTAMP WITH TIME ZONE,
            closing_amount NUMERIC(10, 2),
            expected_amount NUMERIC(10, 2),
            difference NUMERIC(10, 2),
            notes TEXT,
            CONSTRAINT cash_sessions_status_check CHECK (status IN ('open', 'closed'))
          )
        `;
        await sql`
          CREATE INDEX IF NOT EXISTS idx_cash_sessions_user_status
          ON cash_sessions(user_id, status)
        `;
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_sessions_one_open
          ON cash_sessions(user_id)
          WHERE status = 'open'
        `;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_session_id VARCHAR(50)`;
        await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20)`;
      })().catch((error) => {
        this.ready = null;
        throw error;
      });
    }
    await this.ready;
  }

  async getOpen(userId: string): Promise<CashSession | null> {
    const sql = getSql();
    await this.ensureSchema();
    const rows = await sql`
      SELECT * FROM cash_sessions
      WHERE user_id = ${userId} AND status = 'open'
      LIMIT 1
    `;
    return rows.length > 0 ? mapRow(rows[0] as CashSessionRow) : null;
  }

  async open(
    userId: string,
    actor: { id: string; name: string | null },
    openingAmount = 0,
  ): Promise<CashSession> {
    const existing = await this.getOpen(userId);
    if (existing) return existing;

    const sql = getSql();
    const id = `CASH-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();
    try {
      const rows = await sql`
        INSERT INTO cash_sessions (
          id, user_id, status, opened_by, opened_by_name, opened_at, opening_amount
        ) VALUES (
          ${id}, ${userId}, 'open', ${actor.id}, ${actor.name}, ${now},
          ${Math.round(openingAmount * 100) / 100}
        )
        RETURNING *
      `;
      return mapRow(rows[0] as CashSessionRow);
    } catch (error) {
      // Otra pestaña abrió la caja al mismo tiempo: devolvemos la existente.
      if ((error as { code?: string })?.code === '23505') {
        const current = await this.getOpen(userId);
        if (current) return current;
      }
      throw error;
    }
  }

  async getSummary(userId: string, sessionId: string): Promise<CashSessionSummary> {
    const sql = getSql();
    await this.ensureSchema();
    const rows = await sql`
      SELECT
        count(*)::int AS orders,
        COALESCE(sum(total), 0) AS total,
        COALESCE(sum(total) FILTER (WHERE payment_method = 'cash'), 0) AS cash_total,
        COALESCE(sum(total) FILTER (WHERE payment_method = 'card'), 0) AS card_total,
        COALESCE(sum(total) FILTER (WHERE payment_method = 'transfer'), 0) AS transfer_total,
        COALESCE(sum(total) FILTER (WHERE payment_method = 'other'), 0) AS other_total,
        COALESCE(sum(total) FILTER (WHERE payment_method = 'mercadopago'), 0) AS mercadopago_total
      FROM orders
      WHERE user_id = ${userId}
        AND cash_session_id = ${sessionId}
        AND paid_at IS NOT NULL
        AND status != 'canceled'
    `;
    const row = (rows[0] ?? {}) as Record<string, string | number>;
    return {
      orders: Number(row.orders) || 0,
      total: amount(row.total as string | number),
      cashTotal: amount(row.cash_total as string | number),
      cardTotal: amount(row.card_total as string | number),
      transferTotal: amount(row.transfer_total as string | number),
      otherTotal: amount(row.other_total as string | number),
      mercadopagoTotal: amount(row.mercadopago_total as string | number),
    };
  }

  async close(
    userId: string,
    actor: { id: string; name: string | null },
    closingAmount: number,
    notes?: string,
  ): Promise<{ session: CashSession; summary: CashSessionSummary } | null> {
    const current = await this.getOpen(userId);
    if (!current) return null;

    const sql = getSql();
    const summary = await this.getSummary(userId, current.id);
    const expected = Math.round((current.openingAmount + summary.cashTotal) * 100) / 100;
    const closing = Math.round(closingAmount * 100) / 100;
    const difference = Math.round((closing - expected) * 100) / 100;
    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE cash_sessions
      SET status = 'closed',
          closed_by = ${actor.id},
          closed_by_name = ${actor.name},
          closed_at = ${now},
          closing_amount = ${closing},
          expected_amount = ${expected},
          difference = ${difference},
          notes = ${notes ?? null}
      WHERE id = ${current.id} AND user_id = ${userId} AND status = 'open'
      RETURNING *
    `;
    if (rows.length === 0) return null;
    return { session: mapRow(rows[0] as CashSessionRow), summary };
  }
}

export const cashSessionStore = new CashSessionStore();
