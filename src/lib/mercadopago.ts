import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PaymentStatus } from '@/types/payment';

/* Integración mínima con Mercado Pago (Checkout Pro).
   - Creamos una preferencia por pedido y devolvemos su init_point.
   - El cliente escanea el QR (generado por nosotros) o abre el link.
   - El webhook y el polling consultan el pago real y lo concilian.
   Credenciales por cliente: MERCADOPAGO_ACCESS_TOKEN en el entorno. */

const MP_API = 'https://api.mercadopago.com';

function apiBase(): string {
  return (process.env.MERCADOPAGO_API_BASE || MP_API).replace(/\/+$/, '');
}

export interface MercadoPagoPreferenceInput {
  paymentId: string;
  orderId: string;
  title: string;
  amount: number;
  currencyId: string;
  notificationUrl: string;
  backUrls: { success: string; failure: string; pending: string };
  metadata?: Record<string, string>;
}

export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

export interface MercadoPagoPayment {
  id: number | string;
  status?: string | null;
  status_detail?: string | null;
  external_reference?: string | null;
  transaction_amount?: number | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  date_approved?: string | null;
}

export class MercadoPagoError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'MercadoPagoError';
    this.status = status;
  }
}

function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new MercadoPagoError(503, 'Mercado Pago no está configurado');
  return token;
}

export function publicBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || '').replace(
    /\/+$/,
    '',
  );
}

export function mercadopagoConfigured(): boolean {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && publicBaseUrl());
}

async function mpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new MercadoPagoError(
      response.status,
      `Mercado Pago respondió ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
    );
  }
  return response.json() as Promise<T>;
}

/* Payload puro (testeable) de la preferencia de Checkout Pro. */
export function buildPreferencePayload(input: MercadoPagoPreferenceInput) {
  return {
    items: [
      {
        id: input.orderId,
        title: input.title.slice(0, 250),
        quantity: 1,
        unit_price: Math.round(input.amount * 100) / 100,
        currency_id: input.currencyId,
      },
    ],
    external_reference: input.paymentId,
    notification_url: input.notificationUrl,
    back_urls: input.backUrls,
    auto_return: 'approved',
    statement_descriptor: 'LUMEN',
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

export async function createMercadoPagoPreference(
  input: MercadoPagoPreferenceInput,
): Promise<MercadoPagoPreference> {
  return mpFetch<MercadoPagoPreference>('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify(buildPreferencePayload(input)),
  });
}

export async function getMercadoPagoPayment(id: string): Promise<MercadoPagoPayment> {
  return mpFetch<MercadoPagoPayment>(`/v1/payments/${encodeURIComponent(id)}`);
}

export async function searchMercadoPagoPayment(
  externalReference: string,
): Promise<MercadoPagoPayment | null> {
  const data = await mpFetch<{ results?: MercadoPagoPayment[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}&sort=date_created&criteria=desc`,
  );
  const match = (data.results ?? []).find(
    (payment) => payment.external_reference === externalReference,
  );
  return match ?? data.results?.[0] ?? null;
}

export function normalizeMercadoPagoStatus(raw: string | null | undefined): PaymentStatus {
  switch (raw) {
    case 'approved':
      return 'approved';
    case 'pending':
      return 'pending';
    case 'in_process':
    case 'authorized':
      return 'in_process';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'charged_back':
      return 'charged_back';
    default:
      return 'unknown';
  }
}

/* Firma del webhook de Mercado Pago:
   x-signature: ts=<ts>,v1=<hmac>
   manifest: id:<data.id>;request-id:<x-request-id>;ts:<ts>; */
export function verifyMercadoPagoSignature(input: {
  dataId: string;
  requestId: string | null;
  signature: string | null;
  secret: string;
}): boolean {
  if (!input.dataId || !input.signature || !input.secret) return false;

  const parts = new Map<string, string>();
  for (const chunk of input.signature.split(',')) {
    const index = chunk.indexOf('=');
    if (index <= 0) continue;
    parts.set(chunk.slice(0, index).trim(), chunk.slice(index + 1).trim());
  }
  const ts = parts.get('ts');
  const v1 = parts.get('v1');
  if (!ts || !v1) return false;

  const manifest = `id:${input.dataId};request-id:${input.requestId ?? ''};ts:${ts};`;
  const expected = createHmac('sha256', input.secret).update(manifest).digest('hex');
  const receivedBuffer = Buffer.from(v1, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
