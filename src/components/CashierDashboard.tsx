'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Order, PaymentMethod } from '@/types/order';
import { getOrderDisplayNumber } from '@/lib/order-number';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from '@/lib/payments';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Banknote,
  Ban,
  Clock3,
  CreditCard,
  LockKeyhole,
  Receipt,
  Table2,
  UnlockKeyhole,
  X,
} from 'lucide-react';

type TableInfo = { id: string; number: number; zone: string; status: string };

type CashSession = {
  id: string;
  status: 'open' | 'closed';
  openedByName: string | null;
  openedAt: string;
  openingAmount: number;
  closedByName: string | null;
  closedAt: string | null;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
};

type CashSummary = {
  orders: number;
  total: number;
  cashTotal: number;
  cardTotal: number;
  transferTotal: number;
  otherTotal: number;
};

type PayTarget =
  | { kind: 'table'; table: TableInfo }
  | { kind: 'order'; order: Order };

const EMPTY_SUMMARY: CashSummary = {
  orders: 0,
  total: 0,
  cashTotal: 0,
  cardTotal: 0,
  transferTotal: 0,
  otherTotal: 0,
};

const amount = (value: number | string | undefined) => Number(value) || 0;

function zoneLabel(zone: string | undefined) {
  return (zone ?? '').replace(/_/g, ' ');
}

export function CashierDashboard({
  orders,
  onCancelOrder,
  onOrdersChanged,
}: {
  orders: Order[];
  onCancelOrder: (id: string, status: string, reason?: string) => Promise<void> | void;
  onOrdersChanged?: () => void;
}) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [pageError, setPageError] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [session, setSession] = useState<CashSession | null>(null);
  const [summary, setSummary] = useState<CashSummary>(EMPTY_SUMMARY);
  const [cashModal, setCashModal] = useState<'open' | 'close' | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [cashNotes, setCashNotes] = useState('');
  const [cashError, setCashError] = useState('');
  const [cashNotice, setCashNotice] = useState('');
  const [cashSubmitting, setCashSubmitting] = useState(false);

  const money = useCallback(
    (value: number) => `${currencySymbol}${Number(value).toFixed(2)}`,
    [currencySymbol],
  );

  const loadTables = useCallback(async () => {
    try {
      const response = await fetch('/api/tables');
      if (!response.ok) throw new Error('tables');
      const nextTables: TableInfo[] = ((await response.json()).tables || []).sort(
        (a: TableInfo, b: TableInfo) =>
          Number(a.number) - Number(b.number) || String(a.zone).localeCompare(String(b.zone)),
      );
      setTables((prev) =>
        JSON.stringify(prev) === JSON.stringify(nextTables) ? prev : nextTables,
      );
    } catch {
      setPageError('No se pudieron cargar las mesas.');
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/cash-sessions');
      if (!response.ok) return;
      const data = await response.json();
      setSession(data.session ?? null);
      setSummary(data.summary ?? EMPTY_SUMMARY);
    } catch {
      setPageError('No se pudo cargar el estado de la caja.');
    }
  }, []);

  useEffect(() => {
    void loadTables();
    void loadSession();
    fetch('/api/settings')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const symbol = data?.branding?.currencySymbol;
        if (typeof symbol === 'string' && symbol.trim()) setCurrencySymbol(symbol.trim());
      })
      .catch(() => {});
    const tablesInterval = setInterval(() => void loadTables(), 5000);
    const sessionInterval = setInterval(() => void loadSession(), 15000);
    return () => {
      clearInterval(tablesInterval);
      clearInterval(sessionInterval);
    };
  }, [loadTables, loadSession]);

  const activeOrders = useMemo(
    () => orders.filter((order) => order.status !== 'canceled' && !order.paidAt),
    [orders],
  );

  const { ordersByTableId, legacyOrdersByKey } = useMemo(() => {
    const byId = new Map<string, Order[]>();
    const legacy = new Map<string, Order[]>();
    for (const order of activeOrders) {
      if (order.tableId) {
        const list = byId.get(order.tableId) ?? [];
        list.push(order);
        byId.set(order.tableId, list);
        continue;
      }
      if (!order.tableNumber) continue;
      const key = `${order.zone || ''}:${order.tableNumber}`;
      const list = legacy.get(key) ?? [];
      list.push(order);
      legacy.set(key, list);
    }
    return { ordersByTableId: byId, legacyOrdersByKey: legacy };
  }, [activeOrders]);

  const ordersByTable = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const table of tables) {
      const byId = ordersByTableId.get(table.id) ?? [];
      const legacy =
        legacyOrdersByKey.get(`${table.zone}:${table.number}`) ??
        legacyOrdersByKey.get(`:${table.number}`) ??
        [];
      if (byId.length > 0 || legacy.length > 0) {
        map.set(table.id, [...byId, ...legacy]);
      }
    }
    return map;
  }, [legacyOrdersByKey, ordersByTableId, tables]);

  const tableOrders = useCallback(
    (table: TableInfo) => {
      const combined = ordersByTable.get(table.id);
      if (combined) return combined;
      /* La mesa pudo borrarse con el modal abierto: fallback por id/zona. */
      const byId = ordersByTableId.get(table.id) ?? [];
      const legacy =
        legacyOrdersByKey.get(`${table.zone}:${table.number}`) ??
        legacyOrdersByKey.get(`:${table.number}`) ??
        [];
      return [...byId, ...legacy];
    },
    [legacyOrdersByKey, ordersByTable, ordersByTableId],
  );

  const orphanOrders = useMemo(() => {
    const tableIds = new Set(tables.map((table) => table.id));
    const tableKeys = new Set(tables.map((table) => `${table.zone}:${table.number}`));
    const tableNumbers = new Set(tables.map((table) => String(table.number)));
    return activeOrders.filter((order) => {
      if (order.tableId) return !tableIds.has(order.tableId);
      if (!order.tableNumber) return true;
      return (
        !tableKeys.has(`${order.zone || ''}:${order.tableNumber}`) &&
        !tableNumbers.has(String(order.tableNumber))
      );
    });
  }, [activeOrders, tables]);

  const openTotal = useMemo(
    () => activeOrders.reduce((sum, order) => sum + amount(order.total), 0),
    [activeOrders],
  );
  const expectedCash = (session?.openingAmount ?? 0) + summary.cashTotal;
  const closingAmountNumber = Number(cashAmount.replace(',', '.'));
  const closingDifference = Number.isFinite(closingAmountNumber)
    ? Math.round((closingAmountNumber - expectedCash) * 100) / 100
    : 0;

  const targetTotal = (target: PayTarget) =>
    target.kind === 'table'
      ? tableOrders(target.table).reduce((sum, order) => sum + amount(order.total), 0)
      : amount(target.order.total);

  const openPayment = (target: PayTarget) => {
    setPayError('');
    setPayMethod('cash');
    setPayTarget(target);
  };

  const confirmPayment = async () => {
    if (!payTarget) return;
    setPaying(true);
    setPayError('');
    try {
      const response =
        payTarget.kind === 'table'
          ? await fetch(`/api/tables/${payTarget.table.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ closeAccount: true, paymentMethod: payMethod }),
            })
          : await fetch(`/api/orders/${payTarget.order.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paid: true, paymentMethod: payMethod }),
            });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setPayError(data?.error || 'No se pudo registrar el cobro.');
        return;
      }
      setPayTarget(null);
      await Promise.all([loadTables(), loadSession()]);
      onOrdersChanged?.();
    } catch {
      setPayError('Error de red. Revisá tu conexión e intentá de nuevo.');
    } finally {
      setPaying(false);
    }
  };

  const handleCancelOrder = (order: Order) => {
    setCancelTarget(order);
  };

  const confirmCancelOrder = async (reason: string) => {
    if (!cancelTarget) return;
    setCancelingId(cancelTarget.id);
    try {
      await onCancelOrder(cancelTarget.id, 'canceled', reason.trim() || undefined);
      await loadTables();
      onOrdersChanged?.();
      if (payTarget?.kind === 'order' && payTarget.order.id === cancelTarget.id) {
        setPayTarget(null);
      }
      setCancelTarget(null);
    } finally {
      setCancelingId(null);
    }
  };

  const openCashModal = (kind: 'open' | 'close') => {
    setCashError('');
    setCashNotes('');
    setCashNotice('');
    if (kind === 'open') {
      setCashAmount('0');
    } else {
      setCashAmount(expectedCash.toFixed(2));
    }
    setCashModal(kind);
  };

  const submitCash = async () => {
    if (!cashModal) return;
    if (!Number.isFinite(closingAmountNumber) || closingAmountNumber < 0) {
      setCashError('Ingresá un monto válido.');
      return;
    }
    setCashSubmitting(true);
    setCashError('');
    try {
      const response = await fetch('/api/cash-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          cashModal === 'open'
            ? { action: 'open', openingAmount: closingAmountNumber }
            : {
                action: 'close',
                closingAmount: closingAmountNumber,
                notes: cashNotes || undefined,
              },
        ),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setCashError(data?.error || 'No se pudo actualizar la caja.');
        return;
      }
      setSession(data.session ?? null);
      setSummary(data.summary ?? EMPTY_SUMMARY);
      setCashModal(null);
      setCashNotice(cashModal === 'open' ? 'Caja abierta.' : 'Caja cerrada.');
      await loadSession();
    } catch {
      setCashError('Error de red. Intentá de nuevo.');
    } finally {
      setCashSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="mx-auto max-w-6xl min-w-0">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600">
            <Banknote className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-slate-800 sm:text-2xl">
              Caja y mesas
            </h1>
            <p className="text-sm text-slate-500">
              Revisá la cuenta, elegí el medio de pago y cobrá
            </p>
          </div>
        </div>

        {(pageError || payError) && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {pageError || payError}
          </div>
        )}
        {cashNotice && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {cashNotice}
          </div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4 sm:p-5">
            <Receipt className="mb-3 text-indigo-500" />
            <p className="text-sm text-slate-500">Mesas configuradas</p>
            <p className="text-3xl font-black">{tables.length}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 sm:p-5">
            <Clock3 className="mb-3 text-amber-500" />
            <p className="text-sm text-slate-500">Cuenta pendiente</p>
            <p className="text-2xl font-black sm:text-3xl">{money(openTotal)}</p>
          </div>
          <div className="rounded-2xl border bg-white p-4 sm:p-5">
            <Banknote className="mb-3 text-emerald-600" />
            <p className="text-sm text-slate-500">Caja del turno</p>
            <p className="text-2xl font-black sm:text-3xl">{money(summary.total)}</p>
            <p className="mt-1 text-xs text-slate-400">
              {session ? `Abierta por ${session.openedByName || '—'}` : 'Cerrada'}
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Turno de caja
              </p>
              {session ? (
                <p className="mt-1 text-sm text-slate-600">
                  Apertura {money(session.openingAmount)} · Efectivo esperado{' '}
                  <strong>{money(expectedCash)}</strong> · Cobrado {money(summary.total)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-slate-500">
                  No hay una caja abierta. Se abre automáticamente al cobrar.
                </p>
              )}
            </div>
            {session ? (
              <button
                type="button"
                onClick={() => openCashModal('close')}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                <LockKeyhole className="h-4 w-4" />
                Cerrar caja
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openCashModal('open')}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <UnlockKeyhole className="h-4 w-4" />
                Abrir caja
              </button>
            )}
          </div>
          {session && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
              <span>Efectivo: {money(summary.cashTotal)}</span>
              <span>Tarjeta: {money(summary.cardTotal)}</span>
              <span>Transferencia: {money(summary.transferTotal)}</span>
              <span>Otros: {money(summary.otherTotal)}</span>
            </div>
          )}
        </div>

        {tables.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-center text-slate-400 sm:p-12">
            Todavía no hay mesas configuradas.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map((table) => {
              const tableOrderList = tableOrders(table);
              const total = tableOrderList.reduce((sum, order) => sum + amount(order.total), 0);
              const occupied = table.status !== 'available' && table.status !== 'paid' && tableOrderList.length > 0;
              return (
                <button
                  type="button"
                  key={table.id}
                  disabled={!occupied}
                  onClick={() => occupied && openPayment({ kind: 'table', table })}
                  className={`min-w-0 rounded-2xl border-2 bg-white p-4 text-left transition sm:p-5 ${
                    occupied
                      ? 'cursor-pointer border-amber-300 hover:shadow-md'
                      : 'cursor-default border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Table2 className={occupied ? 'shrink-0 text-amber-500' : 'shrink-0 text-slate-400'} />
                      <div>
                        <h2 className="text-xl font-black">Mesa {table.number}</h2>
                        <p className="truncate text-xs text-slate-500">{zoneLabel(table.zone)}</p>
                      </div>
                    </div>
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${
                        occupied ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {occupied ? 'Ocupada' : 'Desocupada'}
                    </span>
                  </div>
                  {occupied ? (
                    <div className="mt-4">
                      <p className="text-sm text-slate-500">
                        {tableOrderList.length} pedido{tableOrderList.length === 1 ? '' : 's'} en la cuenta
                      </p>
                      <p className="mt-1 text-xl font-black text-emerald-700">{money(total)}</p>
                      <p className="mt-2 text-xs font-semibold text-indigo-600">
                        Ver detalle y cobrar
                      </p>
                    </div>
                  ) : (
                    <p className="mt-8 text-center text-sm text-slate-400">Sin pedidos activos</p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {orphanOrders.length > 0 && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <p className="font-bold text-amber-800">Cuentas sin mesa configurada</p>
            <p className="mt-1 text-sm text-amber-700">
              Pedidos de mesas borradas o sin vínculo. Cobralos para que no queden colgados.
            </p>
            <div className="mt-3 space-y-2">
              {orphanOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2"
                >
                  <div>
                    <p className="font-bold text-slate-800">
                      Pedido #{getOrderDisplayNumber(order)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {order.tableNumber ? `Mesa ${order.tableNumber} · ${zoneLabel(order.zone)}` : 'Sin mesa'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-700">{money(amount(order.total))}</span>
                    <button
                      type="button"
                      onClick={() => openPayment({ kind: 'order', order })}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      Cobrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {cashModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
              <h2 className="text-xl font-black text-slate-900">
                {cashModal === 'open' ? 'Abrir caja' : 'Cerrar caja'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {cashModal === 'open'
                  ? 'Ingresá el efectivo inicial del turno.'
                  : `Efectivo esperado: ${money(expectedCash)}`}
              </p>
              <label htmlFor="cash-amount" className="mt-4 block text-sm font-semibold text-slate-600">
                {cashModal === 'open' ? 'Monto inicial' : 'Efectivo contado'}
              </label>
              <input
                id="cash-amount"
                value={cashAmount}
                onChange={(event) => setCashAmount(event.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-slate-900"
              />
              {cashModal === 'close' && (
                <>
                  <p className="mt-2 text-sm text-slate-500">
                    Diferencia: <strong>{money(closingDifference)}</strong>
                  </p>
                  <label htmlFor="cash-notes" className="mt-3 block text-sm font-semibold text-slate-600">
                    Notas (opcional)
                  </label>
                  <textarea
                    id="cash-notes"
                    value={cashNotes}
                    onChange={(event) => setCashNotes(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  />
                </>
              )}
              {cashError && <p className="mt-2 text-sm text-rose-600">{cashError}</p>}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCashModal(null)}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void submitCash()}
                  disabled={cashSubmitting}
                  className="flex-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {cashSubmitting ? 'Guardando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {payTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">
                    Cuenta
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {payTarget.kind === 'table'
                      ? `Mesa ${payTarget.table.number}`
                      : `Pedido #${getOrderDisplayNumber(payTarget.order)}`}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {payTarget.kind === 'table'
                      ? `Salón: ${zoneLabel(payTarget.table.zone)}`
                      : payTarget.order.tableNumber
                        ? `Mesa ${payTarget.order.tableNumber} · ${zoneLabel(payTarget.order.zone)}`
                        : 'Sin mesa'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPayTarget(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                  aria-label="Cerrar"
                >
                  <X />
                </button>
              </div>

              <div className="p-5">
                {(payTarget.kind === 'table' ? tableOrders(payTarget.table) : [payTarget.order]).map(
                  (order) => (
                    <div key={order.id} className="mb-3 rounded-2xl border border-slate-200 p-4">
                      <div className="flex justify-between gap-3">
                        <span className="font-bold">Pedido #{getOrderDisplayNumber(order)}</span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            order.status === 'finished'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {order.status === 'finished' ? 'Terminado' : 'En curso'}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1">
                        {order.items.map((item, index) => (
                          <div
                            key={`${order.id}-${index}`}
                            className="flex justify-between gap-3 text-sm"
                          >
                            <span>
                              {item.quantity}× {item.name}
                            </span>
                            <span className="font-semibold">
                              {money(amount(item.price) * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between border-t pt-3 font-bold">
                        <span>Total pedido</span>
                        <span>{money(amount(order.total))}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleCancelOrder(order)}
                        disabled={cancelingId === order.id}
                        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-rose-50 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        {cancelingId === order.id ? 'Cancelando…' : 'Cancelar pedido'}
                      </button>
                    </div>
                  ),
                )}

                <div className="mt-5 border-t pt-5">
                  <p className="mb-2 text-sm font-semibold text-slate-600">Medio de pago</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((method) => {
                      const Icon = method === 'card' ? CreditCard : method === 'cash' ? Banknote : Receipt;
                      return (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPayMethod(method)}
                          aria-pressed={payMethod === method}
                          className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                            payMethod === method
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {PAYMENT_METHOD_LABELS[method]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!session && (
                  <p className="mt-3 text-xs text-amber-600">
                    No hay caja abierta: se abrirá automáticamente al confirmar el cobro.
                  </p>
                )}
                {payError && <p className="mt-3 text-sm text-rose-600">{payError}</p>}

                <div className="mt-5 flex items-center justify-between border-t pt-5">
                  <span className="text-lg font-bold">Total a cobrar</span>
                  <span className="text-2xl font-black text-emerald-700">
                    {money(targetTotal(payTarget))}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void confirmPayment()}
                  disabled={paying || targetTotal(payTarget) <= 0}
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {paying
                    ? 'Registrando cobro…'
                    : payTarget.kind === 'table'
                      ? 'Confirmar cobro y liberar mesa'
                      : 'Confirmar cobro'}
                </button>
              </div>
            </div>
          </div>
        )}

        {cancelTarget && (
          <ConfirmDialog
            open
            title={`Cancelar pedido #${getOrderDisplayNumber(cancelTarget)}`}
            message="Se quita de la cuenta de la mesa. El motivo queda registrado para auditoría."
            inputLabel="Motivo"
            inputPlaceholder="Ej. el cliente se fue, error de carga…"
            multiline
            confirmLabel="Cancelar pedido"
            cancelLabel="Volver"
            danger
            busy={Boolean(cancelingId)}
            onCancel={() => {
              if (!cancelingId) setCancelTarget(null);
            }}
            onConfirm={(reason) => void confirmCancelOrder(reason)}
          />
        )}
      </div>
    </div>
  );
}
