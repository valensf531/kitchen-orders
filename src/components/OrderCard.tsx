'use client';

import { Order, OrderStatus, OrderItem } from '@/types/order';
import { Clock, Check, UtensilsCrossed, MessageSquare, Coffee, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

interface OrderCardProps {
  order: Order;
  orderNumber: number;
  onStatusChange: (id: string, status: string) => void;
  onItemDelivered?: (orderId: string, itemIndex: number, delivered: boolean) => void;
}

function isDrinkItem(item: OrderItem): boolean {
  return (
    item.category === 'drink' ||
    /^(bebida|drink|refresco|café|coffee|jugo|agua|cerveza|vino|te|soda|cola|limonada)/i.test(item.name)
  );
}

function getTimeAgo(dateString: string | undefined): string {
  if (!dateString) return '0s';
  const now = new Date();
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '0s';
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  
  if (diffMins === 0) return `${diffSecs}s`;
  if (diffMins < 60) return `${diffMins}m ${diffSecs}s`;
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours}h ${diffMins % 60}m`;
}

function getMinutesAgo(dateString: string | undefined): number {
  if (!dateString) return 0;
  const now = new Date();
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 0;
  return (now.getTime() - date.getTime()) / 60000;
}

function getTimeInStatus(
  createdAt: string, 
  processingAt: string | undefined, 
  finishedAt: string | undefined, 
  status: OrderStatus
): { received: string; processing: string } {
  const created = new Date(createdAt);
  const processing = processingAt ? new Date(processingAt) : null;
  const finished = finishedAt ? new Date(finishedAt) : null;
  
  const formatMs = (ms: number) => {
    if (ms <= 0) return '-';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    if (mins === 0) return `${secs}s`;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };
  
  if (status === 'received') {
    const now = new Date();
    return {
      received: formatMs(now.getTime() - created.getTime()),
      processing: '-',
    };
  }
  
  if (status === 'processing') {
    const now = new Date();
    if (processing) {
      const processingTime = now.getTime() - processing.getTime();
      return {
        received: formatMs(processing.getTime() - created.getTime()),
        processing: formatMs(processingTime),
      };
    }
    return {
      received: formatMs(now.getTime() - created.getTime()),
      processing: '-',
    };
  }
  
  if (status === 'finished') {
    if (processing && finished) {
      const processingTime = finished.getTime() - processing.getTime();
      return {
        received: formatMs(processing.getTime() - created.getTime()),
        processing: formatMs(processingTime),
      };
    }
    return {
      received: formatMs(finished ? finished.getTime() - created.getTime() : 0),
      processing: '-',
    };
  }
  
  if (status === 'canceled') {
    if (processing) {
      return {
        received: formatMs(processing.getTime() - created.getTime()),
        processing: '-',
      };
    }
    return {
      received: '-',
      processing: '-',
    };
  }
  
  return { received: '-', processing: '-' };
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string; progress: number; accent: string }> = {
  received: { label: 'Recibido', bg: 'bg-amber-100', text: 'text-amber-700', progress: 33, accent: 'bg-amber-500' },
  processing: { label: 'En Progreso', bg: 'bg-indigo-500', text: 'text-white', progress: 66, accent: 'bg-indigo-500' },
  finished: { label: 'Finalizado', bg: 'bg-teal-100', text: 'text-teal-700', progress: 100, accent: 'bg-teal-500' },
  canceled: { label: 'Cancelado', bg: 'bg-slate-100', text: 'text-slate-500', progress: 0, accent: 'bg-slate-400' },
};

export function OrderCard({ order, orderNumber, onStatusChange, onItemDelivered }: OrderCardProps) {
  const isCompleted = order.status === 'finished' || order.status === 'canceled';
  
  const [timeAgo, setTimeAgo] = useState('0s');
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [timeInStatus, setTimeInStatus] = useState<{ received: string; processing: string }>({ received: '-', processing: '-' });
  const deliveredFromServer = useMemo(() => {
    const delivered = new Set<number>();
    order.items.forEach((item, idx) => {
      if (item.delivered) delivered.add(idx);
    });
    return delivered;
  }, [order.items]);
  const [deliveredItems, setDeliveredItems] = useState<Set<number>>(new Set());

  const drinkItems = order.items.reduce<Array<OrderItem & { originalIndex: number }>>((acc, item, idx) => {
    if (isDrinkItem(item)) acc.push({ ...item, originalIndex: idx });
    return acc;
  }, []);

  const foodItems = order.items.reduce<Array<OrderItem & { originalIndex: number }>>((acc, item, idx) => {
    if (!isDrinkItem(item)) acc.push({ ...item, originalIndex: idx });
    return acc;
  }, []);

  const handleCancel = () => {
    if (!window.confirm(`¿Cancelar el pedido #${String(orderNumber).padStart(3, '0')}? Esta acción libera la mesa si no tiene más pedidos.`)) return;
    onStatusChange(order.id, 'canceled');
  };

  const handleDrinkToggle = (originalIndex: number) => {
    const newDelivered = new Set(deliveredItems);
    if (newDelivered.has(originalIndex)) {
      newDelivered.delete(originalIndex);
    } else {
      newDelivered.add(originalIndex);
    }
    setDeliveredItems(newDelivered);
    onItemDelivered?.(order.id, originalIndex, newDelivered.has(originalIndex));
  };

  useEffect(() => {
    const updateTime = () => {
      if (isCompleted) {
        const totalMs = (order.finishedAt ? new Date(order.finishedAt).getTime() : 0) - new Date(order.createdAt).getTime();
        const formatTotal = (ms: number) => {
          if (ms <= 0) return '-';
          const mins = Math.floor(ms / 60000);
          const secs = Math.floor((ms % 60000) / 1000);
          if (mins === 0) return `${secs}s`;
          if (mins < 60) return `${mins}m ${secs}s`;
          const hours = Math.floor(mins / 60);
          return `${hours}h ${mins % 60}m`;
        };
        setTimeAgo(formatTotal(totalMs));
        setMinutesAgo(getMinutesAgo(order.finishedAt || order.updatedAt));
      } else {
        setTimeAgo(getTimeAgo(order.createdAt));
        setMinutesAgo(getMinutesAgo(order.createdAt));
      }
      setTimeInStatus(getTimeInStatus(order.createdAt, order.processingAt, order.finishedAt, order.status));
    };
    
    updateTime();
    
    if (isCompleted) return;
    
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [order.createdAt, order.processingAt, order.finishedAt, order.status, order.updatedAt, isCompleted]);

  const isOverdue = minutesAgo >= 25 && !isCompleted;
  const statusConfig = STATUS_CONFIG[order.status];

  return (
    <div className={`bg-white rounded-xl p-4 w-full flex flex-col gap-3 border transition-all duration-200 ${
      isOverdue 
        ? 'border-rose-300 ring-2 ring-rose-200' 
        : 'border-slate-200 hover:border-slate-300'
    }`}>
      
      {isOverdue && (
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 bg-rose-500 text-white rounded-lg text-xs font-bold">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Pedido urgente - más de 25 minutos</span>
        </div>
      )}
      
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-800">Pedido #{String(orderNumber).padStart(3, '0')}</h2>
          {order.tableNumber && (
            <p className="text-sm text-indigo-600 font-semibold mt-0.5">Mesa {order.tableNumber}</p>
          )}
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${statusConfig.bg} ${statusConfig.text}`}>
          {order.status === 'finished' && <Check className="w-3 h-3" />}
          <span className="text-[10px] font-bold">{statusConfig.label}</span>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg ${statusConfig.accent} flex items-center justify-center flex-shrink-0`}>
          <Clock className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-[10px] text-slate-500 font-medium">
            {isCompleted ? 'Tiempo total' : 'Tiempo transcurrido'}
          </p>
          <p className={`text-lg font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>{timeAgo}</p>
        </div>
      </div>

      {drinkItems.length > 0 && (
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
          <div className="flex items-center gap-2 mb-2">
            <Coffee className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700 uppercase">Bebidas</span>
            <span className="ml-auto text-[10px] text-amber-500">Marcar al entregar</span>
          </div>
          <div className="space-y-1.5">
            {drinkItems.map((item) => {
              const isDelivered = deliveredItems.has(item.originalIndex) || deliveredFromServer.has(item.originalIndex);
              return (
                <div 
                  key={item.originalIndex} 
                  className={`flex justify-between items-center p-2 rounded-lg transition-colors ${
                    isDelivered 
                      ? 'bg-teal-100 border border-teal-200' 
                      : 'bg-white border border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDrinkToggle(item.originalIndex)}
                      disabled={isCompleted}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        isDelivered 
                          ? 'bg-teal-500 border-teal-500 text-white' 
                          : 'border-amber-300 hover:border-amber-400'
                      } ${isCompleted ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {isDelivered && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <span className={`text-sm ${isDelivered ? 'text-teal-700 line-through' : 'text-slate-700'}`}>
                      {item.name}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isDelivered 
                      ? 'bg-teal-200 text-teal-700' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    x{item.quantity}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-slate-50 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <UtensilsCrossed className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            {drinkItems.length > 0 ? 'Comida' : 'Pedido'}
          </span>
        </div>
        <div className="space-y-1.5">
          {foodItems.map((item) => (
            <div key={item.originalIndex} className="flex justify-between items-center">
              <span className="text-sm text-slate-700">{item.name}</span>
              <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                x{item.quantity}
              </span>
            </div>
          ))}
        </div>
      </div>

      {order.notes && (
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-bold text-amber-600 uppercase">Anotaciones</span>
          </div>
          <p className="text-sm text-slate-700">{order.notes}</p>
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Estado del pedido</p>
        
        <div className="bg-slate-200 rounded-full h-1.5 overflow-hidden mb-2">
          <div 
            className={`h-full ${statusConfig.accent} transition-all duration-300`}
            style={{ width: `${statusConfig.progress}%` }}
          />
        </div>
        
        <div className="flex justify-between text-[10px]">
          <div className="text-center flex-1">
            <p className={`font-bold ${order.status === 'received' || order.status === 'processing' || order.status === 'finished' ? 'text-indigo-600' : 'text-slate-400'}`}>Recibido</p>
            <p className="text-slate-400">{timeInStatus.received}</p>
          </div>
          <div className="text-center flex-1">
            <p className={`font-bold ${order.status === 'processing' || order.status === 'finished' ? 'text-indigo-600' : 'text-slate-400'}`}>En progreso</p>
            <p className="text-slate-400">{timeInStatus.processing || '-'}</p>
          </div>
          <div className="text-center flex-1">
            <p className={`font-bold ${order.status === 'finished' ? 'text-teal-600' : 'text-slate-400'}`}>Finalizado</p>
          </div>
        </div>
        {(order.startedByName || order.finishedByName) && (
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            {order.startedByName ? `Iniciado por ${order.startedByName}` : ''}
            {order.startedByName && order.finishedByName ? ' · ' : ''}
            {order.finishedByName ? `Finalizado por ${order.finishedByName}` : ''}
          </p>
        )}
      </div>

      {order.status === 'received' && (
        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            onClick={() => onStatusChange(order.id, 'processing')}
            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold text-sm transition-all duration-150 hover:shadow-lg hover:shadow-indigo-600/20"
          >
            Iniciar
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-2.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {order.status === 'processing' && (
        <div className="flex gap-2 mt-auto">
          <button
            type="button"
            onClick={() => onStatusChange(order.id, 'finished')}
            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-sm transition-all duration-150 hover:shadow-lg hover:shadow-teal-600/20"
          >
            Finalizar
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-2.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {order.status === 'finished' && (
        <div className="text-center text-teal-600 font-semibold text-sm mt-auto py-2 bg-teal-50 rounded-lg">
          Pedido completado
        </div>
      )}

      {order.status === 'canceled' && (
        <div className="text-center text-slate-500 font-semibold text-sm mt-auto py-2 bg-slate-100 rounded-lg">
          Pedido cancelado
        </div>
      )}
    </div>
  );
}