'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  BarChart3,
  CalendarDays,
  Clock,
  Download,
  Layers,
  Loader2,
  MapPin,
  PackageX,
  Receipt,
  Timer,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import {
  csvNumber,
  formatCurrency,
  formatDuration,
  percentChange,
  rangeForPreset,
  toCsv,
  type RangePreset,
} from '@/lib/stats-format';
import { downloadStatsXlsx } from '@/lib/stats-export';

/* ---------- Tipos del payload de /api/stats ---------- */

interface StageStats {
  count: number;
  avg: number;
  median: number;
  p90: number;
  max: number;
}

interface StatsProduct {
  key: string;
  name: string;
  categoryId: string;
  categoryName: string;
  units: number;
  revenue: number;
}

interface StatsPayload {
  range: { from: string; to: string; timezone: string };
  summary: {
    orders: number;
    canceled: number;
    revenue: number;
    collected: number;
    averageTicket: number;
  };
  previous: { orders: number; revenue: number; averageTicket: number };
  products: StatsProduct[];
  categories: { id: string; name: string; units: number; revenue: number }[];
  unsold: { id: string; name: string }[];
  salesByDay: { day: string; orders: number; revenue: number; collected: number }[];
  salesByHour: { hour: number; orders: number; revenue: number }[];
  zones: { label: string; orders: number; revenue: number }[];
  channels: { label: string; orders: number; revenue: number }[];
  tables: {
    zone: string;
    table: number;
    orders: number;
    revenue: number;
    avgSeconds: number | null;
  }[];
  stages: {
    wait: StageStats;
    prep: StageStats;
    close: StageStats;
    totalPrep: StageStats;
    fullCycle: StageStats;
  };
  slowestProducts: { key: string; name: string; orders: number; avgSeconds: number }[];
}

/* ---------- Helpers de UI ---------- */

const PRESETS: { id: RangePreset | 'custom'; label: string }[] = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'custom', label: 'Personalizado' },
];

const TABS: { id: StatsTab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'productos', label: 'Productos' },
  { id: 'tiempos', label: 'Tiempos' },
  { id: 'salones', label: 'Salones' },
];

const CHANNEL_LABELS: Record<string, string> = {
  'qr-menu': 'Carta QR (clientes)',
  'dining-room': 'Salón (personal)',
  api: 'Otro',
};

type StatsTab = 'resumen' | 'productos' | 'tiempos' | 'salones';
type ProductSort = 'units' | 'revenue';

function toLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  /* BOM para que Excel reconozca el UTF-8 (acentos). */
  const blob = new Blob([`\uFEFF${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Card({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon?: typeof BarChart3;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-slate-800">
          {Icon && <Icon className="w-4 h-4 text-slate-400" />}
          <h3 className="text-sm font-bold">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  delta?: number | null;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-slate-500 mb-3">
        <Icon className="w-4 h-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl sm:text-3xl font-black text-slate-800 break-words tabular-nums" title={value}>
        {value}
      </p>
      {delta !== undefined && delta !== null && Number.isFinite(delta) && (
        <p
          className={`text-xs font-semibold mt-1.5 flex items-center gap-1 ${
            delta >= 0 ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {delta >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {delta >= 0 ? '+' : ''}
          {delta.toFixed(1)}% vs período anterior
        </p>
      )}
    </div>
  );
}

/* Gráfico de barras en CSS puro (labels cada N columnas para no saturar).
   Muestra el valor exacto sobre cada barra etiquetada: nada se simplifica. */
function BarChart({
  data,
  colorClass,
  every = 1,
  formatValue = formatCurrency,
  footer,
}: {
  data: { label: string; value: number; hint?: string }[];
  colorClass: string;
  every?: number;
  formatValue?: (value: number) => string;
  footer?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-400 py-8 text-center">Sin datos en este período</p>;
  }
  const max = Math.max(...data.map((entry) => entry.value), 1);
  return (
    <div>
      <div className="flex items-stretch gap-1" role="img" aria-label="Gráfico de barras">
        {data.map((entry, index) => {
          const labeled = index % every === 0 || index === data.length - 1;
          return (
            <div
              key={`${entry.label}-${index}`}
              className="flex-1 min-w-0 flex flex-col items-center gap-1"
              title={`${entry.hint ?? entry.label}: ${formatValue(entry.value)}`}
            >
              <div className="w-full h-36 flex flex-col justify-end">
                {labeled && entry.value > 0 && (
                  <span className="text-[9px] font-semibold text-slate-500 text-center leading-tight mb-0.5 tabular-nums">
                    {formatValue(entry.value)}
                  </span>
                )}
                <div
                  className={`w-full rounded-t ${colorClass}`}
                  style={{ height: `${Math.max(2, (entry.value / max) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-400 truncate max-w-full text-center">
                {labeled ? entry.label : ''}
              </span>
            </div>
          );
        })}
      </div>
      {footer && <p className="text-xs text-slate-500 mt-2 text-center tabular-nums">{footer}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center">
      <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
      <p className="text-slate-500 font-medium">Todavía no hay datos en este período</p>
      <p className="text-sm text-slate-400 mt-1">Las estadísticas aparecen a medida que entran pedidos.</p>
    </div>
  );
}

/* ---------- Componente principal ---------- */

export function StatsDashboard() {
  const [presetId, setPresetId] = useState<RangePreset | 'custom'>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tab, setTab] = useState<StatsTab>('resumen');
  const [productSort, setProductSort] = useState<ProductSort>('units');
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const range = useMemo(() => {
    if (presetId !== 'custom') return rangeForPreset(presetId);
    if (!customFrom || !customTo) return null;
    const from = new Date(`${customFrom}T00:00:00`);
    const to = new Date(`${customTo}T23:59:59.999`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) return null;
    return { from, to };
  }, [presetId, customFrom, customTo]);

  useEffect(() => {
    if (!range) return;
    let active = true;
    const load = () => {
      if (!active) return;
      setLoading(true);
      fetch(`/api/stats?from=${range.from.toISOString()}&to=${range.to.toISOString()}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('stats request failed'))))
        .then((payload: StatsPayload) => {
          if (!active) return;
          setData(payload);
          setError('');
        })
        .catch(() => {
          if (active) setError('No se pudieron cargar las estadísticas. Intentá de nuevo.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    const timeout = setTimeout(load, 0);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [range]);

  const handlePreset = (id: RangePreset | 'custom') => {
    setPresetId(id);
    if (id === 'custom') {
      const now = new Date();
      setCustomFrom((current) => current || toLocalDateInput(new Date(now.getTime() - 30 * 86_400_000)));
      setCustomTo((current) => current || toLocalDateInput(now));
    }
  };

  const summary = data?.summary;
  const previous = data?.previous;
  const hasData = Boolean(summary && summary.orders + summary.canceled > 0);

  const sortedProducts = useMemo(
    () => [...(data?.products ?? [])].sort((a, b) => b[productSort] - a[productSort]),
    [data, productSort],
  );
  const maxProductValue =
    sortedProducts.length > 0 ? Math.max(...sortedProducts.map((p) => p[productSort]), 1) : 1;

  const dayChartData = (data?.salesByDay ?? []).map((row) => ({
    label: row.day.slice(5).replace('-', '/'),
    value: row.revenue,
    hint: row.day,
  }));
  const hourChartData = Array.from({ length: 24 }, (_, hour) => {
    const row = data?.salesByHour.find((entry) => entry.hour === hour);
    return { label: `${hour}h`, value: row?.revenue ?? 0, hint: `${hour}:00` };
  });

  /* Rango para nombres de archivo + totales exactos del período visible. */
  const fileRange = data
    ? `${data.range.from.slice(0, 10)}_a_${data.range.to.slice(0, 10)}`
    : 'rango';

  const dayTotals = (data?.salesByDay ?? []).reduce(
    (acc, row) => ({
      orders: acc.orders + row.orders,
      revenue: acc.revenue + row.revenue,
      collected: acc.collected + row.collected,
    }),
    { orders: 0, revenue: 0, collected: 0 },
  );

  const dayFooter =
    dayTotals.orders > 0
      ? `Total ${formatCurrency(dayTotals.revenue)} · Cobrado ${formatCurrency(dayTotals.collected)} · ${dayTotals.orders} pedidos`
      : undefined;

  const peakHour = (data?.salesByHour ?? []).reduce<{ hour: number; revenue: number } | null>(
    (best, row) => (!best || row.revenue > best.revenue ? { hour: row.hour, revenue: row.revenue } : best),
    null,
  );
  const hourFooter = peakHour
    ? `Pico ${peakHour.hour}:00 con ${formatCurrency(peakHour.revenue)}`
    : undefined;

  const handleExportXlsx = async () => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      await downloadStatsXlsx(data, `estadisticas-${fileRange}.xlsx`);
    } catch {
      setError('No se pudo generar el Excel. Intentá de nuevo.');
    } finally {
      setExporting(false);
    }
  };

  const stageCards = [
    { id: 'wait', title: 'Espera (recibido → en preparación)', stage: data?.stages.wait },
    { id: 'prep', title: 'Preparación (en preparación → terminado)', stage: data?.stages.prep },
    { id: 'close', title: 'Cierre de cuenta (terminado → cobrado)', stage: data?.stages.close },
    { id: 'totalPrep', title: 'Preparación total (recibido → terminado)', stage: data?.stages.totalPrep },
    { id: 'fullCycle', title: 'Ciclo completo de mesa (recibido → cobrado)', stage: data?.stages.fullCycle },
  ];

  return (
    <div className="p-3 sm:p-6">
      <div className="max-w-6xl mx-auto min-w-0">
        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
            <BarChart3 className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">Estadísticas</h1>
            <p className="text-sm text-slate-500">El negocio en números: ventas, productos y tiempos</p>
          </div>
          <button
            type="button"
            disabled={!hasData || loading || exporting}
            onClick={handleExportXlsx}
            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Excel
          </button>
        </div>

        {/* Selector de período */}
        <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 mb-4 flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePreset(preset.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                presetId === preset.id
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
          {presetId === 'custom' && (
            <div className="flex items-center gap-2 ml-auto">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                aria-label="Fecha desde"
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700"
              />
              <span className="text-slate-400 text-sm">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                aria-label="Fecha hasta"
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-700"
              />
            </div>
          )}
        </div>

        {/* Sub-pestañas */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === entry.id
                  ? 'bg-slate-800 text-white shadow-lg'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300 mx-auto" />
            <p className="text-slate-500 mt-3">Calculando estadísticas…</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm">{error}</div>
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {/* ================= RESUMEN ================= */}
            {tab === 'resumen' && summary && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                  <KpiCard
                    icon={Wallet}
                    label="Ventas"
                    value={formatCurrency(summary.revenue)}
                    delta={percentChange(summary.revenue, previous?.revenue ?? 0)}
                  />
                  <KpiCard icon={Banknote} label="Cobrado" value={formatCurrency(summary.collected)} />
                  <KpiCard
                    icon={Receipt}
                    label="Pedidos"
                    value={String(summary.orders)}
                    delta={percentChange(summary.orders, previous?.orders ?? 0)}
                  />
                  <KpiCard
                    icon={Timer}
                    label="Ticket promedio"
                    value={formatCurrency(summary.averageTicket)}
                    delta={percentChange(summary.averageTicket, previous?.averageTicket ?? 0)}
                  />
                  <KpiCard
                    icon={PackageX}
                    label="Cancelaciones"
                    value={`${
                      summary.orders + summary.canceled > 0
                        ? ((summary.canceled / (summary.orders + summary.canceled)) * 100).toFixed(1)
                        : '0.0'
                    }% (${summary.canceled})`}
                  />
                </div>

                <Card
                  title="Ventas por día"
                  icon={CalendarDays}
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(`ventas-por-dia-${fileRange}.csv`, [
                          ['Día', 'Pedidos', 'Ventas', 'Cobrado', 'A cobrar'],
                          ...(data?.salesByDay ?? []).map((row) => [
                            row.day,
                            row.orders,
                            csvNumber(row.revenue),
                            csvNumber(row.collected),
                            csvNumber(row.revenue - row.collected),
                          ]),
                        ])
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                  }
                >
                  <BarChart
                    data={dayChartData}
                    colorClass="bg-indigo-500"
                    every={Math.max(1, Math.ceil(dayChartData.length / 10))}
                    footer={dayFooter}
                  />
                  {data && data.salesByDay.length > 0 && (
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                            <th className="pb-2 font-semibold">Día</th>
                            <th className="pb-2 font-semibold text-right">Pedidos</th>
                            <th className="pb-2 font-semibold text-right">Ventas</th>
                            <th className="pb-2 font-semibold text-right">Cobrado</th>
                            <th className="pb-2 font-semibold text-right">A cobrar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.salesByDay.map((row) => (
                            <tr key={row.day} className="border-b border-slate-50 last:border-0">
                              <td className="py-2 text-slate-600 tabular-nums">{row.day}</td>
                              <td className="py-2 text-right text-slate-600 tabular-nums">{row.orders}</td>
                              <td className="py-2 text-right font-semibold text-slate-800 tabular-nums">
                                {formatCurrency(row.revenue)}
                              </td>
                              <td className="py-2 text-right font-semibold text-emerald-600 tabular-nums">
                                {formatCurrency(row.collected)}
                              </td>
                              <td className="py-2 text-right text-amber-600 tabular-nums">
                                {formatCurrency(row.revenue - row.collected)}
                              </td>
                            </tr>
                          ))}
                          <tr className="font-bold">
                            <td className="py-2 text-slate-800">Total</td>
                            <td className="py-2 text-right text-slate-800 tabular-nums">{dayTotals.orders}</td>
                            <td className="py-2 text-right text-slate-800 tabular-nums">
                              {formatCurrency(dayTotals.revenue)}
                            </td>
                            <td className="py-2 text-right text-emerald-700 tabular-nums">
                              {formatCurrency(dayTotals.collected)}
                            </td>
                            <td className="py-2 text-right text-amber-700 tabular-nums">
                              {formatCurrency(dayTotals.revenue - dayTotals.collected)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                <Card
                  title="Ventas por hora del día (horas pico)"
                  icon={Clock}
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(`ventas-por-hora-${fileRange}.csv`, [
                          ['Hora', 'Pedidos', 'Ventas'],
                          ...(data?.salesByHour ?? []).map((row) => [
                            `${row.hour}:00`,
                            row.orders,
                            csvNumber(row.revenue),
                          ]),
                        ])
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                  }
                >
                  <BarChart data={hourChartData} colorClass="bg-amber-500" every={3} footer={hourFooter} />
                </Card>
              </>
            )}

            {/* ================= PRODUCTOS ================= */}
            {tab === 'productos' && (
              <>
                <Card
                  title="Productos con más salida"
                  icon={UtensilsCrossed}
                  action={
                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-100 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setProductSort('units')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            productSort === 'units' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                          }`}
                        >
                          Unidades
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductSort('revenue')}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            productSort === 'revenue' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                          }`}
                        >
                          Facturación
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          downloadCsv(`productos-${fileRange}.csv`, [
                            ['Producto', 'Categoría', 'Unidades', 'Facturación'],
                            ...sortedProducts.map((product) => [
                              product.name,
                              product.categoryName,
                              product.units,
                              csvNumber(product.revenue),
                            ]),
                          ])
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-2">
                    {sortedProducts.map((product, index) => (
                      <div key={product.key} className="flex items-center gap-3">
                        <span className="w-6 text-xs font-bold text-slate-400 text-right shrink-0">{index + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-medium text-slate-700 truncate" title={product.name}>
                              {product.name}
                            </p>
                            <p className="text-sm font-semibold text-indigo-600 shrink-0">
                              {productSort === 'units'
                                ? `${product.units} u.`
                                : formatCurrency(product.revenue)}
                            </p>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${productSort === 'units' ? 'bg-indigo-500' : 'bg-teal-500'}`}
                              style={{ width: `${Math.max(1, (product[productSort] / maxProductValue) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {product.categoryName} · {productSort === 'units' ? formatCurrency(product.revenue) : `${product.units} u.`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid sm:grid-cols-2 gap-4">
                  <Card
                    title="Ventas por categoría"
                    icon={Layers}
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          downloadCsv(`categorias-${fileRange}.csv`, [
                            ['Categoría', 'Unidades', 'Facturación'],
                            ...(data?.categories ?? []).map((category) => [
                              category.name,
                              category.units,
                              csvNumber(category.revenue),
                            ]),
                          ])
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    }
                  >
                    {data && data.categories.length > 0 ? (
                      <div className="space-y-2.5">
                        {data.categories.map((category) => {
                          const maxRevenue = Math.max(...data.categories.map((c) => c.revenue), 1);
                          return (
                            <div key={category.id}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-medium text-slate-700 truncate">{category.name}</p>
                                <p className="text-sm font-semibold text-slate-700 shrink-0">
                                  {formatCurrency(category.revenue)}
                                </p>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-violet-500"
                                  style={{ width: `${Math.max(1, (category.revenue / maxRevenue) * 100)}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">{category.units} unidades</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">Sin categorías con ventas</p>
                    )}
                  </Card>

                  <Card title="Sin salida en el período" icon={PackageX}>
                    {data && data.unsold.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {data.unsold.map((product) => (
                          <span
                            key={product.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-xs font-medium"
                            title="Sin ventas en el período seleccionado"
                          >
                            {product.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">
                        ¡Todos los platos del menú tuvieron ventas!
                      </p>
                    )}
                  </Card>
                </div>
              </>
            )}

            {/* ================= TIEMPOS ================= */}
            {tab === 'tiempos' && (
              <>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {stageCards.map(({ id, title, stage }) => (
                    <div key={id} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-slate-500 mb-3">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">{title}</span>
                      </div>
                      <p className="text-2xl font-black text-slate-800">
                        {formatDuration(stage?.avg ?? null)}
                      </p>
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p>
                          Mediana: <span className="font-semibold text-slate-700">{formatDuration(stage?.median ?? null)}</span>
                        </p>
                        <p>
                          P90: <span className="font-semibold text-slate-700">{formatDuration(stage?.p90 ?? null)}</span>
                        </p>
                        <p>
                          Máximo: <span className="font-semibold text-slate-700">{formatDuration(stage?.max ?? null)}</span>
                        </p>
                        <p>
                          Pedidos: <span className="font-semibold text-slate-700">{stage?.count ?? 0}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <Card title="Platos más lentos de preparar" icon={Timer}>
                  {data && data.slowestProducts.length > 0 ? (
                    <div className="space-y-2">
                      {data.slowestProducts.map((product) => (
                        <div key={product.key} className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                          <p className="text-sm font-medium text-slate-700 truncate">{product.name}</p>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-amber-600">{formatDuration(product.avgSeconds)}</p>
                            <p className="text-[11px] text-slate-400">{product.orders} pedidos</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 py-4 text-center">
                      Se necesitan al menos 2 pedidos terminados por plato para medir tiempos.
                    </p>
                  )}
                </Card>
              </>
            )}

            {/* ================= SALONES ================= */}
            {tab === 'salones' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Card
                    title="Ventas por salón"
                    icon={MapPin}
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          downloadCsv(`salones-${fileRange}.csv`, [
                            ['Salón', 'Pedidos', 'Facturación'],
                            ...(data?.zones ?? []).map((zone) => [
                              zone.label,
                              zone.orders,
                              csvNumber(zone.revenue),
                            ]),
                          ])
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    }
                  >
                    {data && data.zones.length > 0 ? (
                      <div className="space-y-2.5">
                        {data.zones.map((zone) => {
                          const maxRevenue = Math.max(...data.zones.map((z) => z.revenue), 1);
                          return (
                            <div key={zone.label}>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-medium text-slate-700 truncate">{zone.label}</p>
                                <p className="text-sm font-semibold text-slate-700 shrink-0">
                                  {formatCurrency(zone.revenue)}
                                </p>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-teal-500"
                                  style={{ width: `${Math.max(1, (zone.revenue / maxRevenue) * 100)}%` }}
                                />
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">{zone.orders} pedidos</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">Sin datos</p>
                    )}
                  </Card>

                  <Card
                    title="Ventas por canal de pedido"
                    icon={Receipt}
                    action={
                      <button
                        type="button"
                        onClick={() =>
                          downloadCsv(`canales-${fileRange}.csv`, [
                            ['Canal', 'Pedidos', 'Facturación'],
                            ...(data?.channels ?? []).map((channel) => [
                              CHANNEL_LABELS[channel.label] ?? channel.label,
                              channel.orders,
                              csvNumber(channel.revenue),
                            ]),
                          ])
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        CSV
                      </button>
                    }
                  >
                    {data && data.channels.length > 0 ? (
                      <div className="space-y-2">
                        {data.channels.map((channel) => (
                          <div
                            key={channel.label}
                            className="flex items-center justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate">
                                {CHANNEL_LABELS[channel.label] ?? channel.label}
                              </p>
                              <p className="text-[11px] text-slate-400">{channel.orders} pedidos</p>
                            </div>
                            <p className="text-sm font-semibold text-teal-600 shrink-0">
                              {formatCurrency(channel.revenue)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 py-4 text-center">Sin datos</p>
                    )}
                  </Card>
                </div>

                <Card
                  title="Mesas con más movimiento"
                  icon={UtensilsCrossed}
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(`mesas-${fileRange}.csv`, [
                          ['Salón', 'Mesa', 'Pedidos', 'Facturación', 'Permanencia prom.'],
                          ...(data?.tables ?? []).map((row) => [
                            row.zone,
                            row.table,
                            row.orders,
                            csvNumber(row.revenue),
                            row.avgSeconds == null ? '—' : formatDuration(row.avgSeconds),
                          ]),
                        ])
                      }
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      CSV
                    </button>
                  }
                >
                  {data && data.tables.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                            <th className="pb-2 font-semibold">Salón</th>
                            <th className="pb-2 font-semibold">Mesa</th>
                            <th className="pb-2 font-semibold text-right">Pedidos</th>
                            <th className="pb-2 font-semibold text-right">Facturación</th>
                            <th className="pb-2 font-semibold text-right">Permanencia prom.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.tables.map((row) => (
                            <tr key={`${row.zone}-${row.table}`} className="border-b border-slate-50 last:border-0">
                              <td className="py-2.5 text-slate-600">{row.zone}</td>
                              <td className="py-2.5 font-semibold text-slate-800">Nº {row.table}</td>
                              <td className="py-2.5 text-right text-slate-600">{row.orders}</td>
                              <td className="py-2.5 text-right font-semibold text-indigo-600">
                                {formatCurrency(row.revenue)}
                              </td>
                              <td className="py-2.5 text-right text-slate-500">{formatDuration(row.avgSeconds)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 py-4 text-center">Sin pedidos con mesa en este período</p>
                  )}
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
