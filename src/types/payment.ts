export type PaymentProvider = 'mercadopago';

export type PaymentStatus =
  | 'pending'
  | 'in_process'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back'
  | 'unknown';

export interface Payment {
  id: string;
  userId: string;
  orderId: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  statusDetail?: string;
  amount: number;
  currency: string;
  preferenceId?: string;
  mpPaymentId?: string;
  method?: string;
  initPoint?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPayment {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  orderId: string;
  paidAt?: string;
  initPoint?: string;
}
