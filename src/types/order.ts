export type OrderStatus = 'received' | 'processing' | 'finished' | 'canceled';

export type OrderItemCategory = 'food' | 'drink';

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
  source?: string;
  notes?: string;
  zone?: string;
}

export interface CreateOrderInput {
  userId: string;
  customerName: string;
  tableNumber?: number;
  items: OrderItem[];
  total: number;
  source?: string;
  notes?: string;
  zone?: string;
}
