'use client';

import { Order } from '@/types/order';
import { Zone } from '@/types/table';
import { NotificationManager } from './NotificationManager';
import { OrderList } from './OrderList';
import { Sidebar, SidebarSection, KitchenTab, DiningTab } from './Sidebar';
import { TableManagement } from './TableManagement';
import { DiningRoom } from './DiningRoom';
import { SettingsPage } from './SettingsPage';
import { useEffect, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import { Bell, BellOff, Volume2, VolumeX, X, AlertCircle } from 'lucide-react';
import { CashierDashboard } from './CashierDashboard';
import { StatsDashboard } from './StatsDashboard';
import { useNewOrderSound, playBeep } from '@/hooks/use-new-order-sound';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useAccess } from '@/hooks/use-access';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { getOrderDisplayNumber } from '@/lib/order-number';

export function KitchenDisplay() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SidebarSection>('kitchen');
  const [activeKitchenTab, setActiveKitchenTab] = useState<KitchenTab>('active');
  const [activeDiningTab, setActiveDiningTab] = useState<DiningTab>('orders');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [liveConnected, setLiveConnected] = useState(false);
  const [readyNotice, setReadyNotice] = useState<Order | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const finishedSeenRef = useRef<Set<string> | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ordersInFlightRef = useRef(false);

  const online = useOnlineStatus();
  const { isAdmin, isKitchen, loaded: accessLoaded } = useAccess();
  const ordersKey = orders.map((order) => order.id).join(',');
  useNewOrderSound(ordersKey, soundEnabled);
  useWakeLock();

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem('kitchen-sound') === '1');
    setNotificationsEnabled(
      'Notification' in window && Notification.permission === 'granted',
    );
  }, []);

  const toggleSound = () => {
    setSoundEnabled((current) => {
      const next = !current;
      window.localStorage.setItem('kitchen-sound', next ? '1' : '0');
      return next;
    });
  };

  const fetchOrders = useCallback(async () => {
    /* Evita requests solapadas si una tarda más que el intervalo. */
    if (ordersInFlightRef.current) return;
    ordersInFlightRef.current = true;
    try {
      const res = await fetch('/api/orders?active=1');
      /* 304 (ETag sin cambios): no hay cuerpo que parsear. */
      if (res.status === 304) return;
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const next = data.orders || [];
      /* Evita re-renderizar toda la pantalla si no cambió nada. */
      setOrders(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      ordersInFlightRef.current = false;
      setLoading(false);
    }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch('/api/zones');
      const data = await res.json();
      const next = data.zones || [];
      setZones(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    } catch (error) {
      console.error('Failed to fetch zones:', error);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchZones();
    /* El polling queda como respaldo; con SSE conectado baja a 15s. */
    const interval = setInterval(fetchOrders, liveConnected ? 15000 : 5000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchZones, liveConnected]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;

    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      source = new EventSource('/api/orders/stream');
      source.onopen = () => {
        if (!stopped) setLiveConnected(true);
      };
      source.addEventListener('orders', (event) => {
        try {
          const data = JSON.parse((event as MessageEvent<string>).data) as { orders?: Order[] };
          const next = data.orders ?? [];
          setOrders((prev) =>
            JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
          );
          setLoading(false);
        } catch {
          /* mensaje inválido: seguimos con el polling */
        }
      });
      source.onerror = () => {
        if (!stopped) setLiveConnected(false);
        source?.close();
        if (!stopped) retry = setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, []);

  useEffect(() => {
    const finished = orders.filter((order) => order.status === 'finished');
    if (finishedSeenRef.current === null) {
      finishedSeenRef.current = new Set(finished.map((order) => order.id));
      return;
    }

    const seen = finishedSeenRef.current;
    const newReady = finished.filter((order) => !seen.has(order.id));
    finished.forEach((order) => seen.add(order.id));
    if (newReady.length === 0 || !accessLoaded || isKitchen) return;

    const latest = newReady[0];
    setReadyNotice(latest);
    playBeep();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Pedido listo para entregar', {
        body: `Pedido #${getOrderDisplayNumber(latest)}${
          latest.tableNumber ? ` · Mesa ${latest.tableNumber}` : ''
        }`,
        icon: '/logo.png',
        tag: `ready-${latest.id}`,
      });
    }
    if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    readyTimerRef.current = setTimeout(() => setReadyNotice(null), 12000);
  }, [orders, accessLoaded, isKitchen]);

  useEffect(
    () => () => {
      if (readyTimerRef.current) clearTimeout(readyTimerRef.current);
    },
    [],
  );

  const enableNotifications = async () => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      setNotificationsEnabled(true);
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationsEnabled(permission === 'granted');
  };

  const handleStatusChange = async (id: string, status: string, reason?: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reason }),
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const errorData = await res.json().catch(() => null);
        const message = errorData?.error || 'No se pudo actualizar el pedido';
        console.error('Failed to update order:', errorData, 'Order ID:', id);
        setActionError(message);
      }
    } catch (error) {
      console.error('Failed to update order:', error);
      setActionError('Error de red. Revisá tu conexión e intentá de nuevo.');
    }
  };

  const handleItemDelivered = async (orderId: string, itemIndex: number, delivered: boolean) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemDelivered: { index: itemIndex, delivered } }),
      });
      if (res.ok) {
        fetchOrders();
      } else {
        const text = await res.text();
        console.error('Failed to update item delivery:', text || res.statusText);
        setActionError('No se pudo marcar la bebida. Intentá de nuevo.');
      }
    } catch (error) {
      console.error('Failed to update item delivery:', error);
      setActionError('Error de red. Revisá tu conexión e intentá de nuevo.');
    }
  };

  const activeOrdersCount = orders.filter(o => o.status === 'received' || o.status === 'processing').length;
  const receivedCount = orders.filter(o => o.status === 'received').length;
  const processingCount = orders.filter(o => o.status === 'processing').length;
  const finishedCount = orders.filter(o => o.status === 'finished').length;
  const canceledCount = orders.filter(o => o.status === 'canceled').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Image 
            src="/logo.png" 
            alt="Lumen Logo" 
            width={64}
            height={64}
            className="w-16 h-16 rounded-xl mx-auto mb-4"
          />
          <p className="text-slate-500 font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        activeKitchenTab={activeKitchenTab}
        onKitchenTabChange={setActiveKitchenTab}
        activeDiningTab={activeDiningTab}
        onDiningTabChange={setActiveDiningTab}
        activeOrdersCount={activeOrdersCount}
        receivedCount={receivedCount}
        processingCount={processingCount}
        finishedCount={finishedCount}
        canceledCount={canceledCount}
      />

      {!online && (
        <div className="fixed inset-x-0 top-0 z-[60] bg-rose-600 text-white text-center text-sm font-medium py-1.5 px-4 shadow-lg">
          Sin conexión. Los pedidos no se actualizan hasta que vuelva la red.
        </div>
      )}

      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void enableNotifications()}
          aria-pressed={notificationsEnabled}
          title={
            notificationsEnabled
              ? 'Notificaciones activas'
              : 'Activar notificaciones del navegador'
          }
          className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-colors ${
            notificationsEnabled
              ? 'border-amber-500 bg-amber-500 text-white'
              : 'border-slate-200 bg-white text-slate-400 hover:text-amber-600'
          }`}
        >
          {notificationsEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={soundEnabled}
          title={soundEnabled ? 'Silenciar alerta de pedidos' : 'Activar alerta sonora de pedidos'}
          className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition-colors ${
            soundEnabled
              ? 'border-teal-600 bg-teal-600 text-white'
              : 'border-slate-200 bg-white text-slate-400 hover:text-teal-600'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </div>

      {readyNotice && !isKitchen && (
        <div className="fixed bottom-24 left-4 z-50 max-w-sm rounded-xl border border-teal-200 bg-white p-4 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-wide text-teal-600">
            Pedido listo
          </p>
          <p className="mt-1 font-bold text-slate-800">
            #{getOrderDisplayNumber(readyNotice)}
            {readyNotice.tableNumber ? ` · Mesa ${readyNotice.tableNumber}` : ''}
            {readyNotice.zone ? ` · ${readyNotice.zone.replace(/_/g, ' ')}` : ''}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveSection('dining');
                setActiveDiningTab('orders');
                setReadyNotice(null);
              }}
              className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white"
            >
              Ir a Salón
            </button>
            <button
              type="button"
              onClick={() => setReadyNotice(null)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <main className="lg:ml-64 min-h-screen pb-24 lg:pb-0">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg">
          Saltar al contenido principal
        </a>
        
        <div id="main-content">
          {actionError && (
            <div className="mx-4 sm:mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="flex-1">{actionError}</p>
              <button
                type="button"
                onClick={() => setActionError(null)}
                aria-label="Cerrar error"
                className="p-1 hover:bg-rose-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {activeSection === 'settings' ? (
            !accessLoaded ? (
              <div className="p-6 text-center text-slate-400">Cargando...</div>
            ) : isAdmin ? (
              <SettingsPage />
            ) : (
              <div className="p-6 max-w-md mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <p className="font-bold text-slate-800">Sin acceso</p>
                  <p className="text-sm text-slate-500 mt-1">
                    La configuración está reservada a administradores.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSection('kitchen')}
                    className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium"
                  >
                    Ir a Cocina
                  </button>
                </div>
              </div>
            )
          ) : activeSection === 'stats' ? (
            !accessLoaded ? (
              <div className="p-6 text-center text-slate-400">Cargando...</div>
            ) : isAdmin ? (
              <StatsDashboard />
            ) : (
              <div className="p-6 max-w-md mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <p className="font-bold text-slate-800">Sin acceso</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Las estadísticas están reservadas a administradores.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSection('kitchen')}
                    className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium"
                  >
                    Ir a Cocina
                  </button>
                </div>
              </div>
            )
          ) : activeSection === 'kitchen' ? (
            <OrderList 
              orders={orders} 
              currentTab={activeKitchenTab} 
              onStatusChange={handleStatusChange}
              onItemDelivered={handleItemDelivered}
            />
          ) : activeSection === 'cashier' ? (
            !accessLoaded ? (
              <div className="p-6 text-center text-slate-400">Cargando...</div>
            ) : isKitchen ? (
              <div className="p-6 max-w-md mx-auto">
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                  <p className="font-bold text-slate-800">Sin acceso</p>
                  <p className="text-sm text-slate-500 mt-1">
                    La caja es para vendedores y administradores.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveSection('kitchen')}
                    className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium"
                  >
                    Ir a Cocina
                  </button>
                </div>
              </div>
            ) : (
            <CashierDashboard
              orders={orders}
              onCancelOrder={handleStatusChange}
              onOrdersChanged={() => {
                void fetchOrders();
                void fetchZones();
              }}
            />
            )
          ) : !accessLoaded ? (
            <div className="p-6 text-center text-slate-400">Cargando...</div>
          ) : isKitchen ? (
            <div className="p-6 max-w-md mx-auto">
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <p className="font-bold text-slate-800">Sin acceso</p>
                <p className="text-sm text-slate-500 mt-1">
                  El salón es para vendedores y administradores.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection('kitchen')}
                  className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium"
                >
                  Ir a Cocina
                </button>
              </div>
            </div>
          ) : activeDiningTab === 'orders' ? (
            <DiningRoom orders={orders} />
          ) : (
            <TableManagement 
              zone={activeDiningTab} 
              zoneName={zones.find(z => z.slug === activeDiningTab)?.name} 
            />
          )}
        </div>
      </main>

      <NotificationManager orders={orders} />
    </div>
  );
}
