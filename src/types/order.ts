export type OrderStatus = 'received' | 'processing' | 'finished' | 'canceled';

export type OrderItemCategory = 'food' | 'drink';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

export interface OrderItem {
  name: string;
  quantity: number;
  price?: number;
  notes?: string;
  category?: OrderItemCategory;
  delivered?: boolean;
  menuItemId?: string;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  tableNumber?: number;
  tableId?: string;
  displayNumber?: number;
  clientOrderId?: string;
  paymentMethod?: PaymentMethod;
  paidBy?: string;
  paidByName?: string;
  cashSessionId?: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  processingAt?: string;
  finishedAt?: string;
  paidAt?: string;
  startedBy?: string;
  startedByName?: string;
  finishedBy?: string;
  finishedByName?: string;
  canceledAt?: string;
  canceledBy?: string;
  canceledByName?: string;
  cancelReason?: string;
  source?: string;
  notes?: string;
  zone?: string;
}

export interface CreateOrderInput {
  userId: string;
  customerName: string;
  tableNumber?: number;
  tableId?: string;
  clientOrderId?: string;
  items: OrderItem[];
  total: number;
  source?: string;
  notes?: string;
  zone?: string;
}
