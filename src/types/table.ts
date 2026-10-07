export type TableStatus = 'available' | 'occupied' | 'pending_payment' | 'paid';

export type ZoneType = string;

export interface TablePosition {
  x: number;
  y: number;
}

export interface Table {
  id: string;
  number: number;
  zone: ZoneType;
  status: TableStatus;
  position: TablePosition;
  shape: 'circle' | 'square' | 'rectangle';
  seats: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTableInput {
  number: number;
  zone: ZoneType;
  position?: TablePosition;
  shape?: 'circle' | 'square' | 'rectangle';
  seats?: number;
}

export interface UpdateTableInput {
  number?: number;
  status?: TableStatus;
  position?: TablePosition;
  shape?: 'circle' | 'square' | 'rectangle';
  seats?: number;
}

export interface Zone {
  id: string;
  name: string;
  slug: string;
}

export const STATUS_CONFIG: Record<TableStatus, { label: string; color: string; bgColor: string; bgLight: string; borderColor: string; ringColor: string }> = {
  available: { 
    label: 'Disponible', 
    color: 'text-teal-700', 
    bgColor: 'bg-teal-500',
    bgLight: 'bg-teal-500/20',
    borderColor: 'border-teal-200',
    ringColor: 'ring-teal-400'
  },
  occupied: { 
    label: 'Ocupada', 
    color: 'text-amber-700', 
    bgColor: 'bg-amber-500',
    bgLight: 'bg-amber-500/20',
    borderColor: 'border-amber-200',
    ringColor: 'ring-amber-400'
  },
  pending_payment: { 
    label: 'Pago Pendiente', 
    color: 'text-rose-700', 
    bgColor: 'bg-rose-500',
    bgLight: 'bg-rose-500/20',
    borderColor: 'border-rose-200',
    ringColor: 'ring-rose-400'
  },
  paid: { 
    label: 'Pagado', 
    color: 'text-indigo-700', 
    bgColor: 'bg-indigo-500',
    bgLight: 'bg-indigo-500/20',
    borderColor: 'border-indigo-200',
    ringColor: 'ring-indigo-400'
  },
};

export const SHAPE_CONFIG: Record<'circle' | 'square' | 'rectangle', { label: string; width: number; height: number }> = {
  circle: { label: 'Redonda', width: 80, height: 80 },
  square: { label: 'Cuadrada', width: 80, height: 80 },
  rectangle: { label: 'Rectangular', width: 120, height: 80 },
};