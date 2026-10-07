import { getSql } from '@/lib/db';
import { orderStore } from '@/lib/store';

export interface StatsSummary {
  orders: number;
  canceled: number;
  revenue: number;
  collected: number;
  averageTicket: number;
}

export interface ProductSaleRow {
  key: string;
  name: string;
  units: number;
  revenue: number;
}

export interface DaySaleRow {
  day: string;
  orders: number;
  revenue: number;
  collected: number;
}

export interface HourSaleRow {
  hour: number;
  orders: number;
  revenue: number;
}

export interface GroupSaleRow {
  label: string;
  orders: number;
  revenue: number;
}

export interface TableSaleRow {
  zone: string;
  table: number;
  orders: number;
  revenue: number;
  avgSeconds: number | null;
}

export interface StageStats {
  count: number;
  avg: number;
  median: number;
  p90: number;
  max: number;
}

export interface StageTimings {
  wait: StageStats;
  prep: StageStats;
  close: StageStats;
  totalPrep: StageStats;
  fullCycle: StageStats;
}

export interface ProductPrepRow {
  key: string;
  name: string;
  orders: number;
  avgSeconds: number;
}

const numeric = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/*
 * Estadísticas del negocio: todas las agregaciones se hacen en SQL
 * (nunca se traen las órdenes a memoria). Se filtra siempre por
 * user_id + rango de created_at usando el índice (user_id, created_at DESC).
 */
class StatsStore {
  private async ready() {
    await orderStore.ensureSchema();
  }

  /* Resumen del período: ventas (no canceladas), cobrado, pedidos y ticket promedio. */
  async getSummary(userId: string, from: string, to: string): Promise<StatsSummary> {
    const sql = getSql();
    await this.ready();

    const rows = await sql`
      SELECT
        count(*) FILTER (WHERE status != 'canceled')::int AS orders,
        count(*) FILTER (WHERE status = 'canceled')::int AS canceled,
        COALESCE(sum(total) FILTER (WHERE status != 'canceled'), 0) AS revenue,
        COALESCE(sum(total) FILTER (WHERE status != 'canceled' AND paid_at IS NOT NULL), 0) AS collected,
        COALESCE(avg(total) FILTER (WHERE status != 'canceled'), 0) AS average_ticket
      FROM orders
      WHERE user_id = ${userId} AND created_at >= ${from} AND created_at < ${to}
    `;
    const row = (rows[0] ?? {}) as Record<string, string | number>;

    return {
      orders: numeric(row.orders),
      canceled: numeric(row.canceled),
      revenue: numeric(row.revenue),
      collected: numeric(row.collected),
      averageTicket: numeric(row.average_ticket),
    };
  }

  /* Unidades e ingresos por producto (agregando el jsonb de items). */
  async getProductSales(userId: string, from: string, to: string): Promise<ProductSaleRow[]> {
    const sql = getSql();
    await this.ready();

    const rows = await sql`
      SELECT
        COALESCE(NULLIF(elem->>'menuItemId', ''), lower(btrim(elem->>'name'))) AS product_key,
        max(elem->>'name') AS display_name,
        SUM(CASE WHEN (elem->>'quantity') ~ '^[0-9]+$' THEN (elem->>'quantity')::int ELSE 1 END)::int AS units,
        COALESCE(SUM(
          CASE WHEN (elem->>'quantity') ~ '^[0-9]+$' THEN (elem->>'quantity')::int ELSE 1 END *
          CASE WHEN (elem->>'price') ~ '^[0-9]+(\.[0-9]+)?$' THEN (elem->>'price')::numeric ELSE 0 END
        ), 0) AS revenue
      FROM orders, jsonb_array_elements(items) AS elem
      WHERE user_id = ${userId}
        AND status != 'canceled'
        AND created_at >= ${from} AND created_at < ${to}
        AND jsonb_typeof(items) = 'array'
      GROUP BY 1
    `;

    return (rows as { product_key: string; display_name: string | null; units: string | number; revenue: string | number }[]).map((row) => ({
      key: row.product_key,
      name: row.display_name ?? row.product_key,
      units: numeric(row.units),
      revenue: numeric(row.revenue),
    }));
  }

  /* Ventas por día (en la zona horaria del restaurante). */
  async getSalesByDay(
    userId: string,
    from: string,
    to: string,
    tz: string,
  ): Promise<DaySaleRow[]> {
    const sql = getSql();
    await this.ready();

    const rows = await sql`
      SELECT
        to_char(created_at AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day,
        count(*)::int AS orders,
        COALESCE(sum(total), 0) AS revenue,
        COALESCE(sum(total) FILTER (WHERE paid_at IS NOT NULL), 0) AS collected
      FROM orders
      WHERE user_id = ${userId}
        AND status != 'canceled'
        AND created_at >= ${from} AND created_at < ${to}
      GROUP BY 1
      ORDER BY 1
    `;

    return (rows as { day: string; orders: string | number; revenue: string | number; collected: string | number }[]).map((row) => ({
      day: row.day,
      orders: numeric(row.orders),
      revenue: numeric(row.revenue),
      collected: numeric(row.collected),
    }));
  }

  /* Ventas por hora del día (para detectar horas pico). */
  async getSalesByHour(
    userId: string,
    from: string,
    to: string,
    tz: string,
  ): Promise<HourSaleRow[]> {
    const sql = getSql();
    await this.ready();

    const rows = await sql`
      SELECT
        (extract(hour FROM created_at AT TIME ZONE ${tz}))::int AS hour,
        count(*)::int AS orders,
        COALESCE(sum(total), 0) AS revenue
      FROM orders
      WHERE user_id = ${userId}
        AND status != 'canceled'
        AND created_at >= ${from} AND created_at < ${to}
      GROUP BY 1
      ORDER BY 1
    `;

    return (rows as { hour: string | number; orders: string | number; revenue: string | number }[]).map((row) => ({
      hour: numeric(row.hour),
      orders: numeric(row.orders),
      revenue: numeric(row.revenue),
    }));
  }

  /* Ventas agrupadas por una columna simple (zona o canal de origen). */
  private async getSalesBy(
    userId: string,
    from: string,
    to: string,
    column: 'zone' | 'source',
  ): Promise<GroupSaleRow[]> {
    const sql = getSql();
    await this.ready();

    const rows =
      column === 'zone'
        ? await sql`
            SELECT COALESCE(NULLIF(zone, ''), 'Sin salón') AS label,
                   count(*)::int AS orders,
                   COALESCE(sum(total), 0) AS revenue
            FROM orders
            WHERE user_id = ${userId}
              AND status != 'canceled'
              AND created_at >= ${from} AND created_at < ${to}
            GROUP BY 1
            ORDER BY revenue DESC
          `
        : await sql`
            SELECT COALESCE(NULLIF(source, ''), 'Sin origen') AS label,
                   count(*)::int AS orders,
                   COALESCE(sum(total), 0) AS revenue
            FROM orders
            WHERE user_id = ${userId}
              AND status != 'canceled'
              AND created_at >= ${from} AND created_at < ${to}
            GROUP BY 1
            ORDER BY revenue DESC
          `;

    return (rows as { label: string; orders: string | number; revenue: string | number }[]).map((row) => ({
      label: row.label,
      orders: numeric(row.orders),
      revenue: numeric(row.revenue),
    }));
  }

  async getSalesByZone(userId: string, from: string, to: string) {
    return this.getSalesBy(userId, from, to, 'zone');
  }

  async getSalesByChannel(userId: string, from: string, to: string) {
    return this.getSalesBy(userId, from, to, 'source');
  }

  /* Uso y facturación por mesa, con la permanencia promedio (creación→cobro). */
  async getTableStats(userId: string, from: string, to: string): Promise<TableSaleRow[]> {
    const sql = getSql();
    await this.ready();

    const rows = await sql`
      SELECT
        COALESCE(NULLIF(zone, ''), 'Sin salón') AS zone,
        table_number AS table,
        count(*)::int AS orders,
        COALESCE(sum(total), 0) AS revenue,
        avg(EXTRACT(epoch FROM (paid_at - created_at))) AS avg_seconds
      FROM orders
      WHERE user_id = ${userId}
        AND status != 'canceled'
        AND table_number IS NOT NULL
        AND created_at >= ${from} AND created_at < ${to}
      GROUP BY 1, 2
      ORDER BY revenue DESC
    `;

    return (rows as {
      zone: string;
      table: string | number;
      orders: string | number;
      revenue: string | number;
      avg_seconds: string | number | null;
    }[]).map((row) => ({
      zone: row.zone,
      table: numeric(row.table),
      orders: numeric(row.orders),
      revenue: numeric(row.revenue),
      avgSeconds: row.avg_seconds === null ? null : numeric(row.avg_seconds),
    }));
  }

  /*
   * Tiempos por etapa (segundos): espera (creación→en preparación),
   * preparación (→terminado), cierre (→cobrado), total de preparación
   * y ciclo completo de mesa. Promedio, mediana, P90 y máximo.
   */
  async getStageTimings(userId: string, from: string, to: string): Promise<StageTimings> {
    const sql = getSql();
    await this.ready();

    const rows = await sql`
      SELECT
        count(*) FILTER (WHERE processing_at IS NOT NULL)::int AS wait_count,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (processing_at - created_at))), 0) AS wait_median,
        COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (processing_at - created_at))), 0) AS wait_p90,
        COALESCE(avg(EXTRACT(epoch FROM (processing_at - created_at))), 0) AS wait_avg,
        COALESCE(max(EXTRACT(epoch FROM (processing_at - created_at))), 0) AS wait_max,

        count(*) FILTER (WHERE finished_at IS NOT NULL AND processing_at IS NOT NULL)::int AS prep_count,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (finished_at - processing_at))), 0) AS prep_median,
        COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (finished_at - processing_at))), 0) AS prep_p90,
        COALESCE(avg(EXTRACT(epoch FROM (finished_at - processing_at))), 0) AS prep_avg,
        COALESCE(max(EXTRACT(epoch FROM (finished_at - processing_at))), 0) AS prep_max,

        count(*) FILTER (WHERE paid_at IS NOT NULL AND finished_at IS NOT NULL)::int AS close_count,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (paid_at - finished_at))), 0) AS close_median,
        COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (paid_at - finished_at))), 0) AS close_p90,
        COALESCE(avg(EXTRACT(epoch FROM (paid_at - finished_at))), 0) AS close_avg,
        COALESCE(max(EXTRACT(epoch FROM (paid_at - finished_at))), 0) AS close_max,

        count(*) FILTER (WHERE finished_at IS NOT NULL)::int AS total_prep_count,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (finished_at - created_at))), 0) AS total_prep_median,
        COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (finished_at - created_at))), 0) AS total_prep_p90,
        COALESCE(avg(EXTRACT(epoch FROM (finished_at - created_at))), 0) AS total_prep_avg,
        COALESCE(max(EXTRACT(epoch FROM (finished_at - created_at))), 0) AS total_prep_max,

        count(*) FILTER (WHERE paid_at IS NOT NULL)::int AS full_cycle_count,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (paid_at - created_at))), 0) AS full_cycle_median,
        COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(epoch FROM (paid_at - created_at))), 0) AS full_cycle_p90,
        COALESCE(avg(EXTRACT(epoch FROM (paid_at - created_at))), 0) AS full_cycle_avg,
        COALESCE(max(EXTRACT(epoch FROM (paid_at - created_at))), 0) AS full_cycle_max
      FROM orders
      WHERE user_id = ${userId}
        AND status != 'canceled'
        AND created_at >= ${from} AND created_at < ${to}
    `;

    const row = (rows[0] ?? {}) as Record<string, string | number>;

    const stage = (name: string): StageStats => ({
      count: numeric(row[`${name}_count`]),
      avg: numeric(row[`${name}_avg`]),
      median: numeric(row[`${name}_median`]),
      p90: numeric(row[`${name}_p90`]),
      max: numeric(row[`${name}_max`]),
    });

    return {
      wait: stage('wait'),
      prep: stage('prep'),
      close: stage('close'),
      totalPrep: stage('total_prep'),
      fullCycle: stage('full_cycle'),
    };
  }

  /* Platos más lentos de preparar (mínimo 2 pedidos para que sea significativo). */
  async getProductPrepTimes(
    userId: string,
    from: string,
    to: string,
    minOrders = 2,
  ): Promise<ProductPrepRow[]> {
    const sql = getSql();
    await this.ready();

    const rows = await sql`
      SELECT
        COALESCE(NULLIF(elem->>'menuItemId', ''), lower(btrim(elem->>'name'))) AS product_key,
        max(elem->>'name') AS display_name,
        count(*)::int AS orders,
        COALESCE(avg(EXTRACT(epoch FROM (finished_at - created_at))), 0) AS avg_seconds
      FROM orders, jsonb_array_elements(items) AS elem
      WHERE user_id = ${userId}
        AND status != 'canceled'
        AND created_at >= ${from} AND created_at < ${to}
        AND jsonb_typeof(items) = 'array'
        AND finished_at IS NOT NULL
      GROUP BY 1
      HAVING count(*) >= ${minOrders}
      ORDER BY avg_seconds DESC
      LIMIT 10
    `;

    return (rows as {
      product_key: string;
      display_name: string | null;
      orders: string | number;
      avg_seconds: string | number;
    }[]).map((row) => ({
      key: row.product_key,
      name: row.display_name ?? row.product_key,
      orders: numeric(row.orders),
      avgSeconds: numeric(row.avg_seconds),
    }));
  }
}

export const statsStore = new StatsStore();
