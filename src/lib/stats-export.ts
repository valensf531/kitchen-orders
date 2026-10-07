'use client';

/* Exportación a Excel real (XLSX multi-hoja) desde el payload ya cargado.
   Los montos van como número (no texto) para poder sumarlos en Excel. */

export interface StatsExportInput {
  range: { from: string; to: string; timezone: string };
  summary: { orders: number; canceled: number; revenue: number; collected: number; averageTicket: number };
  products: { name: string; categoryName: string; units: number; revenue: number }[];
  categories: { name: string; units: number; revenue: number }[];
  salesByDay: { day: string; orders: number; revenue: number; collected: number }[];
  salesByHour: { hour: number; orders: number; revenue: number }[];
  zones: { label: string; orders: number; revenue: number }[];
  channels: { label: string; orders: number; revenue: number }[];
  tables: { zone: string; table: number; orders: number; revenue: number; avgSeconds: number | null }[];
}

type Sheet = (string | number | null)[][];

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

function sheetFrom(headers: string[], rows: (string | number | null)[][]): Sheet {
  return [headers, ...rows];
}

/* Aplica formato moneda a las columnas indicadas (índices 0-based). */
function applyMoneyFormat(
  XLSX: typeof import('xlsx'),
  ws: import('xlsx').WorkSheet,
  moneyCols: number[],
  rowCount: number,
): void {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = 1; r <= rowCount; r += 1) {
    for (const c of moneyCols) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (cell && typeof cell.v === 'number') cell.z = '#,##0.00';
    }
  }
  ws['!cols'] = range.e.c >= 0 ? Array.from({ length: range.e.c + 1 }, () => ({ wch: 18 })) : [];
}

export async function downloadStatsXlsx(input: StatsExportInput, filename: string): Promise<void> {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  const add = (name: string, sheet: Sheet, moneyCols: number[]) => {
    const ws = XLSX.utils.aoa_to_sheet(sheet);
    applyMoneyFormat(XLSX, ws, moneyCols, sheet.length - 1);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };

  add(
    'Resumen',
    sheetFrom(
      ['Concepto', 'Valor'],
      [
        ['Período desde', input.range.from.slice(0, 10)],
        ['Período hasta', input.range.to.slice(0, 10)],
        ['Zona horaria', input.range.timezone],
        ['Pedidos', input.summary.orders],
        ['Cancelaciones', input.summary.canceled],
        ['Ventas', money(input.summary.revenue)],
        ['Cobrado', money(input.summary.collected)],
        ['A cobrar', money(input.summary.revenue - input.summary.collected)],
        ['Ticket promedio', money(input.summary.averageTicket)],
      ],
    ),
    [],
  );

  const dayRows = input.salesByDay.map((row) => [
    row.day,
    row.orders,
    money(row.revenue),
    money(row.collected),
    money(row.revenue - row.collected),
  ]);
  add('Por día', sheetFrom(['Día', 'Pedidos', 'Ventas', 'Cobrado', 'A cobrar'], dayRows), [2, 3, 4]);

  add(
    'Por hora',
    sheetFrom(
      ['Hora', 'Pedidos', 'Ventas'],
      input.salesByHour.map((row) => [`${row.hour}:00`, row.orders, money(row.revenue)]),
    ),
    [2],
  );

  add(
    'Productos',
    sheetFrom(
      ['Producto', 'Categoría', 'Unidades', 'Facturación'],
      input.products.map((p) => [p.name, p.categoryName, p.units, money(p.revenue)]),
    ),
    [3],
  );

  add(
    'Categorías',
    sheetFrom(
      ['Categoría', 'Unidades', 'Facturación'],
      input.categories.map((c) => [c.name, c.units, money(c.revenue)]),
    ),
    [2],
  );

  add(
    'Salones',
    sheetFrom(
      ['Salón', 'Pedidos', 'Facturación'],
      input.zones.map((z) => [z.label, z.orders, money(z.revenue)]),
    ),
    [2],
  );

  add(
    'Canales',
    sheetFrom(
      ['Canal', 'Pedidos', 'Facturación'],
      input.channels.map((c) => [c.label, c.orders, money(c.revenue)]),
    ),
    [2],
  );

  add(
    'Mesas',
    sheetFrom(
      ['Salón', 'Mesa', 'Pedidos', 'Facturación', 'Permanencia (s)'],
      input.tables.map((t) => [t.zone, t.table, t.orders, money(t.revenue), t.avgSeconds ?? null]),
    ),
    [3],
  );

  XLSX.writeFile(wb, filename);
}
