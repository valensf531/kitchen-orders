import { randomUUID } from 'node:crypto';
import { getSql } from '@/lib/db';
import type { Payment, PaymentStatus } from '@/types/payment';

type PaymentRow = {
  id: string;
  user_id: string;
  order_id: string;
  provider: string;
  status: string;
  status_detail: string | null;
  amount: string | number;
  currency: string;
  preference_id: string | null;
  mp_payment_id: string | null;
  method: string | null;
  init_point: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

const amount = (value: string | number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const STATUSES: PaymentStatus[] = [
  'pending',
  'in_process',
  'approved',
  'rejected',
  'cancelled',
  'refunded',
  'charged_back',
  'unknown',
];

function mapRow(row: PaymentRow): Payment {
  return {
    id: row.id,
    userId: row.user_id,
    orderId: row.order_id,
    provider: 'mercadopago',
    status: STATUSES.includes(row.status as PaymentStatus)
      ? (row.status as PaymentStatus)
      : 'unknown',
    statusDetail: row.status_detail ?? undefined,
    amount: amount(row.amount),
    currency: row.currency,
    preferenceId: row.preference_id ?? undefined,
    mpPaymentId: row.mp_payment_id ?? undefined,
    method: row.method ?? undefined,
    initPoint: row.init_point ?? undefined,
    paidAt: row.paid_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class PaymentStore {
  private schemaReady: Promise<void> | null = null;

  /* Red de seguridad para bases creadas antes de existir payments. */
  async ensureSchema() {
    if (process.env.SKIP_AUTO_SCHEMA === '1') return;
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        const sql = getSql();
        await sql`
          CREATE TABLE IF NOT EXISTS payments (
            id VARCHAR(50) PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            order_id VARCHAR(50) NOT NULL,
            provider VARCHAR(20) NOT NULL DEFAULT 'mercadopago',
            status VARCHAR(30) NOT NULL DEFAULT 'pending',
            status_detail TEXT,
            amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
            currency VARCHAR(10) NOT NULL DEFAULT 'ARS',
            preference_id VARCHAR(150),
            mp_payment_id VARCHAR(100),
            method VARCHAR(50),
            init_point TEXT,
            paid_at TIMESTAMP WITH TIME ZONE,
            raw JSONB,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
          )
        `;
        await sql`CREATE INDEX IF NOT EXISTS idx_payments_user_created ON payments(user_id, created_at DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id)`;
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_order_pending
          ON payments(order_id) WHERE status IN ('pending', 'in_process')
        `;
        await sql`
          CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_mp_id
          ON payments(mp_payment_id) WHERE mp_payment_id IS NOT NULL
        `;
      })().catch((error) => {
        this.schemaReady = null;
        throw error;
      });
    }
    await this.schemaReady;
  }

  async create(input: {
    userId: string;
    orderId: string;
    amount: number;
    currency: string;
  }): Promise<Payment> {
    const sql = getSql();
    await this.ensureSchema();
    const id = `PAY-${randomUUID().replace(/-/g, '')}`;
    const rows = await sql`
      INSERT INTO payments (id, user_id, order_id, amount, currency)
      VALUES (${id}, ${input.userId}, ${input.orderId}, ${input.amount}, ${input.currency})
      RETURNING *
    `;
    return mapRow(rows[0] as PaymentRow);
  }

  async getById(id: string): Promise<Payment | undefined> {
    const sql = getSql();
    await this.ensureSchema();
    const rows = await sql`SELECT * FROM payments WHERE id = ${id} LIMIT 1`;
    return rows.length > 0 ? mapRow(rows[0] as PaymentRow) : undefined;
  }

  async getPendingByOrderId(
    userId: string,
    orderId: string,
  ): Promise<Payment | undefined> {
    const sql = getSql();
    await this.ensureSchema();
    const rows = await sql`
      SELECT * FROM payments
      WHERE user_id = ${userId} AND order_id = ${orderId}
        AND status IN ('pending', 'in_process')
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows.length > 0 ? mapRow(rows[0] as PaymentRow) : undefined;
  }

  async update(
    id: string,
    patch: {
      status?: PaymentStatus;
      statusDetail?: string | null;
      preferenceId?: string;
      mpPaymentId?: string;
      method?: string | null;
      initPoint?: string;
      paidAt?: string | null;
      raw?: unknown;
    },
  ): Promise<Payment | undefined> {
    const sql = getSql();
    await this.ensureSchema();
    const rows = await sql`
      UPDATE payments
      SET status = COALESCE(${patch.status ?? null}, status),
          status_detail = COALESCE(${patch.statusDetail ?? null}, status_detail),
          preference_id = COALESCE(${patch.preferenceId ?? null}, preference_id),
          mp_payment_id = COALESCE(${patch.mpPaymentId ?? null}, mp_payment_id),
          method = COALESCE(${patch.method ?? null}, method),
          init_point = COALESCE(${patch.initPoint ?? null}, init_point),
          paid_at = COALESCE(${patch.paidAt ?? null}, paid_at),
          raw = COALESCE(${patch.raw === undefined ? null : JSON.stringify(patch.raw)}::jsonb, raw),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return rows.length > 0 ? mapRow(rows[0] as PaymentRow) : undefined;
  }
}

export const paymentStore = new PaymentStore();
