'use client';

import { Order } from '@/types/order';
import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, X, Clock } from 'lucide-react';

interface NotificationManagerProps {
  orders: Order[];
}

function getOverdueOrders(orders: Order[]): Order[] {
  const now = new Date();
  return orders.filter(order => {
    if (order.status === 'finished' || order.status === 'canceled') return false;
    const createdAt = new Date(order.createdAt);
    const diffMins = (now.getTime() - createdAt.getTime()) / 60000;
    return diffMins >= 25;
  });
}

export function NotificationManager({ orders }: NotificationManagerProps) {
  const [overdueOrders, setOverdueOrders] = useState<Order[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const hasNotifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      const overdue = getOverdueOrders(orders);
      /* Evita re-renderizar cada segundo si la lista de vencidos no cambió. */
      setOverdueOrders(prev =>
        prev.length === overdue.length && prev.every((order, index) => order.id === overdue[index].id)
          ? prev
          : overdue,
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [orders]);

  useEffect(() => {
    const newOverdue = overdueOrders.filter(o => !hasNotifiedRef.current.has(o.id));
    
    if (newOverdue.length > 0 && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Lumen Kitchen - Alerta', {
          body: `${newOverdue.length} pedido${newOverdue.length > 1 ? 's' : ''} esperando más de 25 minutos!`,
          icon: '/logo.png',
          tag: 'kitchen-alert',
        });
        newOverdue.forEach(o => hasNotifiedRef.current.add(o.id));
      } else if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [overdueOrders]);

  const visibleOverdue = overdueOrders.filter(o => !dismissed.has(o.id));

  if (visibleOverdue.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm toast-in">
      <div className="bg-gradient-to-br from-red-600 to-red-700 text-white p-4 rounded-xl shadow-2xl shadow-red-500/30 border border-red-500/50 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0 animate-pulse">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg">¡Urgente!</p>
            <p className="text-sm text-red-100">
              {visibleOverdue.length} pedido{visibleOverdue.length > 1 ? 's' : ''} con más de 25 minutos
            </p>
          </div>
          <button 
            onClick={() => setDismissed(prev => {
              const next = new Set(prev);
              visibleOverdue.forEach(o => next.add(o.id));
              return next;
            })}
            aria-label="Cerrar notificación"
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-white/50"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        
        <div className="mt-3 space-y-2">
          {visibleOverdue.slice(0, 2).map(order => (
            <div key={order.id} className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 flex items-center gap-2 border border-white/10">
              <Clock className="w-4 h-4 text-red-200" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Mesa {order.tableNumber}</p>
                <p className="text-xs text-red-200">{order.items.length} artículo{order.items.length > 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
          {visibleOverdue.length > 2 && (
            <p className="text-xs text-red-200 text-center">
              +{visibleOverdue.length - 2} más
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
