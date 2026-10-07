/* Helpers puros de estadísticas: formateo, variaciones, rangos y CSV. */

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* Duraciones legibles: 45s, 12m 30s, 1h 5m. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return '—';
  }
  const total = Math.round(seconds);
  if (total < 60) return `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${secs}s`;
}

/* Variación porcentual entre períodos; null si no hay base de comparación. */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export type RangePreset = 'today' | '7d' | '30d' | 'month';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/* Rango de fechas de cada preset (horario local del navegador). */
export function rangeForPreset(
  preset: RangePreset,
  now = new Date(),
): { from: Date; to: Date } {
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: now };
    case '7d':
      return { from: new Date(startOfDay(now).getTime() - 6 * 86_400_000), to: now };
    case '30d':
      return { from: new Date(startOfDay(now).getTime() - 29 * 86_400_000), to: now };
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  }
}

/* CSV con separador ';' y decimales con coma, listo para Excel en español. */
export function toCsv(rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const text = String(value).replace(/[\r\n]+/g, ' ');
    if (/[;"\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };
  return rows.map((row) => row.map(escape).join(';')).join('\n');
}

export function csvNumber(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2).replace('.', ',');
}
