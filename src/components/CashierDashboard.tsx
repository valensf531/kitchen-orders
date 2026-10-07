'use client';

import { useEffect, useMemo, useState } from 'react';
import { Order } from '@/types/order';
import { Banknote, Ban, Clock3, Receipt, Table2, X, CheckCircle2 } from 'lucide-react';

type TableInfo = { id: string; number: number; zone: string; status: string };

export function CashierDashboard({ orders, onCancelOrder }: { orders: Order[]; onCancelOrder: (id: string, status: string) => Promise<void> | void }) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableInfo | null>(null);
  const [paying, setPaying] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const amount = (value: number | string | undefined) => Number(value) || 0;
  const activeOrders = useMemo(() => orders.filter((order) => order.tableNumber && order.status !== 'canceled' && !order.paidAt), [orders]);
  const ordersByTable = useMemo(() => {
    const grouped = new Map<string, Order[]>();
    activeOrders.forEach((order) => {
      const key = `${order.zone || ''}:${order.tableNumber}`;
      const list = grouped.get(key) || [];
      list.push(order);
      grouped.set(key, list);
    });
    return grouped;
  }, [activeOrders]);

  const loadTables = async () => {
    const response = await fetch('/api/tables');
    if (response.ok) {
      const nextTables = ((await response.json()).tables || []).sort((a: TableInfo, b: TableInfo) => Number(a.number) - Number(b.number) || String(a.zone).localeCompare(String(b.zone)));
      setTables(nextTables);
      setSelectedTable((current) => current ? nextTables.find((table: TableInfo) => table.id === current.id) || null : null);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await fetch('/api/tables');
      if (!active || !response.ok) return;
      const nextTables = ((await response.json()).tables || []).sort((a: TableInfo, b: TableInfo) => Number(a.number) - Number(b.number) || String(a.zone).localeCompare(String(b.zone)));
      /* Evita re-renderizar el tablero en cada polling si no cambió nada. */
      setTables(prev => (JSON.stringify(prev) === JSON.stringify(nextTables) ? prev : nextTables));
      setSelectedTable(current => {
        if (!current) return current;
        const next = nextTables.find((table: TableInfo) => table.id === current.id) || null;
        return next && JSON.stringify(next) === JSON.stringify(current) ? current : next;
      });
    };
    const timeout = setTimeout(load, 0);
    const interval = setInterval(load, 5000);
    return () => {
      active = false;
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  const tableOrders = (table: TableInfo) => {
    if (table.status === 'available' || table.status === 'paid') return [];
    return ordersByTable.get(`${table.zone}:${table.number}`) || ordersByTable.get(`:${table.number}`) || [];
  };
  const openTotal = tables.reduce((sum, table) => sum + tableOrders(table).filter((order) => order.status !== 'finished').reduce((tableSum, order) => tableSum + amount(order.total), 0), 0);
  const payTable = async () => {
    if (!selectedTable) return;
    setPaying(true);
    const response = await fetch(`/api/tables/${selectedTable.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closeAccount: true }) });
    if (response.ok) { setSelectedTable(null); await loadTables(); }
    setPaying(false);
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm(`¿Cancelar el pedido ${orderId}? Se quita de la cuenta de la mesa.`)) return;
    setCancelingId(orderId);
    try { await onCancelOrder(orderId, 'canceled'); } finally { setCancelingId(null); }
  };

  return <div className="p-3 sm:p-6"><div className="max-w-6xl mx-auto min-w-0"><div className="flex items-center gap-3 mb-6"><div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0"><Banknote className="text-white" /></div><div className="min-w-0"><h1 className="text-xl sm:text-2xl font-bold text-slate-800 truncate">Caja y mesas</h1><p className="text-sm text-slate-500">Tocá una mesa ocupada para revisar y cobrar su cuenta</p></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6"><div className="bg-white border rounded-2xl p-4 sm:p-5"><Receipt className="text-indigo-500 mb-3" /><p className="text-sm text-slate-500">Mesas configuradas</p><p className="text-3xl font-black">{tables.length}</p></div><div className="bg-white border rounded-2xl p-4 sm:p-5"><Clock3 className="text-amber-500 mb-3" /><p className="text-sm text-slate-500">Cuenta pendiente</p><p className="text-2xl sm:text-3xl font-black">${openTotal.toFixed(2)}</p></div></div>{tables.length === 0 ? <div className="bg-white border rounded-2xl p-8 sm:p-12 text-center text-slate-400">Todavía no hay mesas configuradas.</div> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">{tables.map((table) => { const tableOrderList = tableOrders(table); const total = tableOrderList.reduce((sum, order) => sum + amount(order.total), 0); const occupied = table.status !== 'available' && table.status !== 'paid' && tableOrderList.length > 0; return <button type="button" key={table.id} disabled={!occupied} onClick={() => occupied && setSelectedTable(table)} className={`text-left bg-white rounded-2xl border-2 p-4 sm:p-5 min-w-0 transition ${occupied ? 'border-amber-300 hover:shadow-md cursor-pointer' : 'border-slate-200 cursor-default'}`}><div className="flex justify-between items-start gap-2"><div className="flex items-center gap-2 min-w-0"><Table2 className={occupied ? 'text-amber-500 shrink-0' : 'text-slate-400 shrink-0'} /><div><h2 className="text-xl font-black">Mesa {table.number}</h2><p className="text-xs text-slate-500 truncate">{table.zone}</p></div></div><span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${occupied ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>{occupied ? 'Ocupada' : 'Desocupada'}</span></div>{occupied ? <div className="mt-4"><p className="text-sm text-slate-500">{tableOrderList.length} pedido{tableOrderList.length === 1 ? '' : 's'} en la cuenta</p><p className="mt-1 text-xl font-black text-emerald-700">${total.toFixed(2)}</p><p className="mt-2 text-xs text-indigo-600 font-semibold">Ver detalle y cobrar →</p></div> : <p className="mt-8 text-center text-sm text-slate-400">Sin pedidos activos</p>}</button>})}</div>}</div>{selectedTable && <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm p-4 flex items-center justify-center"><div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl"><div className="flex items-start justify-between gap-4 border-b p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Cuenta de mesa</p><h2 className="mt-1 text-2xl font-black">Mesa {selectedTable.number}</h2><p className="text-sm text-slate-500">Salón: {selectedTable.zone}</p></div><button onClick={() => setSelectedTable(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X /></button></div><div className="p-5">{tableOrders(selectedTable).length === 0 ? <div className="py-8 text-center text-slate-400"><CheckCircle2 className="mx-auto mb-3 text-slate-300" />No hay pedidos cargados en esta mesa.</div> : <div className="space-y-3">{tableOrders(selectedTable).map((order) => <div key={order.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><span className="font-bold">{order.id}</span><span className={`rounded-full px-2 py-1 text-xs font-bold ${order.status === 'finished' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{order.status === 'finished' ? 'Terminado' : 'En curso'}</span></div><div className="mt-3 space-y-1">{order.items.map((item, index) => <div key={`${order.id}-${index}`} className="flex justify-between gap-3 text-sm"><span>{item.quantity}× {item.name}</span><span className="font-semibold">${(amount(item.price) * item.quantity).toFixed(2)}</span></div>)}</div><div className="mt-3 border-t pt-3 flex justify-between font-bold"><span>Total pedido</span><span>${amount(order.total).toFixed(2)}</span></div><button type="button" onClick={() => handleCancelOrder(order.id)} disabled={cancelingId === order.id} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 transition-colors"><Ban className="w-3.5 h-3.5" />{cancelingId === order.id ? 'Cancelando…' : 'Cancelar pedido'}</button></div>)}</div>}<div className="mt-5 border-t pt-5 flex justify-between items-center"><span className="text-lg font-bold">Subtotal</span><span className="text-2xl font-black text-emerald-700">${tableOrders(selectedTable).reduce((sum, order) => sum + amount(order.total), 0).toFixed(2)}</span></div><button onClick={payTable} disabled={paying} className="mt-4 w-full rounded-xl bg-emerald-600 py-3.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{paying ? 'Registrando pago...' : 'Marcar pagada y desocupar mesa'}</button></div></div></div>}</div>;
}
