'use client';

import { Order } from '@/types/order';
import { Zone } from '@/types/table';
import { NotificationManager } from './NotificationManager';
import { OrderList } from './OrderList';
import { Sidebar, SidebarSection, KitchenTab, DiningTab } from './Sidebar';
import { TableManagement } from './TableManagement';
import { DiningRoom } from './DiningRoom';
import { SettingsPage } from './SettingsPage';
import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Volume2, VolumeX, X, AlertCircle } from 'lucide-react';
import { CashierDashboard } from './CashierDashboard';
import { StatsDashboard } from './StatsDashboard';
import { useNewOrderSound } from '@/hooks/use-new-order-sound';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { useAccess } from '@/hooks/use-access';

export function KitchenDisplay() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SidebarSection>('kitchen');
  const [activeKitchenTab, setActiveKitchenTab] = useState<KitchenTab>('active');
  const [activeDiningTab, setActiveDiningTab] = useState<DiningTab>('orders');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const online = useOnlineStatus();
  const { isAdmin, isKitchen, loaded: accessLoaded } = useAccess();
  const ordersKey = orders.map((order) => order.id).join(',');
  useNewOrderSound(ordersKey, soundEnabled);

  useEffect(() => {
    setSoundEnabled(window.localStorage.getItem('kitchen-sound') === '1');
  }, []);

  const toggleSound = () => {
    setSoundEnabled((current) => {
      const next = !current;
      window.localStorage.setItem('kitchen-sound', next ? '1' : '0');
      return next;
    });
  };

  const fetchOrders = useCallback(async () => {
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
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchZones]);

  const handleStatusChange = async (id: string, status: string) => {
    setActionError(null);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
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

      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={soundEnabled}
        title={soundEnabled ? 'Silenciar alerta de pedidos' : 'Activar alerta sonora de pedidos'}
        className={`fixed top-4 right-4 z-40 flex items-center justify-center w-10 h-10 rounded-full border shadow-lg transition-colors ${
          soundEnabled
            ? 'bg-teal-600 border-teal-600 text-white'
            : 'bg-white border-slate-200 text-slate-400 hover:text-teal-600'
        }`}
      >
        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
      </button>

      <main className="lg:ml-64 min-h-screen">
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
            <CashierDashboard orders={orders} onCancelOrder={handleStatusChange} />
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
            <DiningRoom />
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
