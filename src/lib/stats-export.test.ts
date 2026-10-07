import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { downloadStatsXlsx, type StatsExportInput } from '@/lib/stats-export';

const input: StatsExportInput = {
  range: { from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z', timezone: 'America/Argentina/Buenos_Aires' },
  summary: { orders: 10, canceled: 1, revenue: 1234.5, collected: 1000, averageTicket: 123.45 },
  products: [{ name: 'Pizza', categoryName: 'Pizzas', units: 5, revenue: 500 }],
  categories: [{ name: 'Pizzas', units: 5, revenue: 500 }],
  salesByDay: [{ day: '2026-09-30', orders: 10, revenue: 1234.5, collected: 1000 }],
  salesByHour: [{ hour: 20, orders: 6, revenue: 700 }],
  zones: [{ label: 'Salón', orders: 10, revenue: 1234.5 }],
  channels: [{ label: 'qr-menu', orders: 10, revenue: 1234.5 }],
  tables: [{ zone: 'Salón', table: 1, orders: 4, revenue: 400, avgSeconds: 3600 }],
};

describe('downloadStatsXlsx', () => {
  it('genera un XLSX con las 8 hojas y montos como número', async () => {
    const path = join(tmpdir(), `stats-test-${Date.now()}.xlsx`);
    await downloadStatsXlsx(input, path);
    const XLSX = await import('xlsx');
    const wb = XLSX.readFile(path);
    expect(wb.SheetNames).toEqual([
      'Resumen',
      'Por día',
      'Por hora',
      'Productos',
      'Categorías',
      'Salones',
      'Canales',
      'Mesas',
    ]);
    const day = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Por día'], { header: 1 });
    expect(day[0]).toEqual(['Día', 'Pedidos', 'Ventas', 'Cobrado', 'A cobrar']);
    expect(day[1]).toEqual(['2026-09-30', 10, 1234.5, 1000, 234.5]);
  });
});
