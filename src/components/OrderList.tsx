'use client';

import { Order, OrderStatus } from '@/types/order';
import { OrderCard } from './OrderCard';
import { getOrderDisplayNumber } from '@/lib/order-ops';
import { CheckCircle, XCircle, AlertTriangle, Clock, Flame, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';

interface OrderListProps {
  orders: Order[];
  currentTab: 'active' | OrderStatus | 'dining';
  onStatusChange: (id: string, status: string) => void;
  onItemDelivered?: (orderId: string, itemIndex: number, delivered: boolean) => void;
}

export function OrderList({ orders, currentTab, onStatusChange, onItemDelivered }: OrderListProps) {
  const [overdueCount, setOverdueCount] = useState(0);
  const [receivedCount, setReceivedCount] = useState(0);
  const [processingCount, setProcessingCount] = useState(0);

  useEffect(() => {
    /* Los contadores solo se muestran en la pestaña Activos. */
    if (currentTab !== 'active') return;
    const updateCounts = () => {
      const now = Date.now();
      const overdue = orders.filter(o => {
        if (o.status === 'finished' || o.status === 'canceled') return false;
        const mins = (now - new Date(o.createdAt).getTime()) / 60000;
        return mins >= 25;
      }).length;
      
      setOverdueCount(overdue);
      setReceivedCount(orders.filter(o => o.status === 'received').length);
      setProcessingCount(orders.filter(o => o.status === 'processing').length);
    };

    updateCounts();
    const interval = setInterval(updateCounts, 1000);
    return () => clearInterval(interval);
  }, [orders, currentTab]);

  const getFilteredOrders = () => {
    if (currentTab === 'active') {
      return orders
        .filter(o => o.status === 'received' || o.status === 'processing')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return orders.filter(o => o.status === currentTab);
  };

  const filteredOrders = getFilteredOrders();

  return (
    <div className="p-4 sm:p-6">
      {currentTab === 'active' && overdueCount > 0 && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-rose-800">{overdueCount} pedido{overdueCount > 1 ? 's' : ''} con más de 25 minutos!</p>
            <p className="text-sm text-rose-600">Estos pedidos necesitan atención inmediata</p>
          </div>
        </div>
      )}

      {currentTab === 'active' && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">Recibidos</p>
                  <p className="text-xl font-bold text-slate-800">{receivedCount}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-medium">En progreso</p>
                  <p className="text-xl font-bold text-slate-800">{processingCount}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center mb-4 ${
            currentTab === 'active' ? 'bg-indigo-100' :
            currentTab === 'finished' ? 'bg-teal-100' :
            currentTab === 'canceled' ? 'bg-rose-100' : 'bg-slate-100'
          }`}>
            {currentTab === 'active' && <Clock className="w-8 h-8 text-indigo-400" />}
            {currentTab === 'finished' && <CheckCircle className="w-8 h-8 text-teal-400" />}
            {currentTab === 'canceled' && <XCircle className="w-8 h-8 text-rose-400" />}
            {currentTab === 'received' && <Loader2 className="w-8 h-8 text-amber-400" />}
            {currentTab === 'processing' && <Flame className="w-8 h-8 text-indigo-400" />}
          </div>
          <p className="text-base font-semibold text-slate-700">No hay pedidos</p>
          <p className="text-sm text-slate-400 mt-1">Los pedidos aparecerán aquí</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              orderNumber={getOrderDisplayNumber(order.id)}
              onStatusChange={onStatusChange}
              onItemDelivered={onItemDelivered}
            />
          ))}
        </div>
      )}
    </div>
  );
}