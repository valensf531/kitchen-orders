import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildPreferencePayload,
  normalizeMercadoPagoStatus,
  verifyMercadoPagoSignature,
} from '@/lib/mercadopago';

describe('mercadopago', () => {
  it('arma la preferencia con monto redondeado y referencia externa', () => {
    const payload = buildPreferencePayload({
      paymentId: 'PAY-123',
      orderId: 'ORD-1',
      title: 'Pedido #1 - Restaurante',
      amount: 1234.567,
      currencyId: 'ARS',
      notificationUrl: 'https://resto.test/api/webhooks/mercadopago',
      backUrls: {
        success: 'https://resto.test/menu?payment=success',
        failure: 'https://resto.test/menu?payment=failure',
        pending: 'https://resto.test/menu?payment=pending',
      },
      metadata: { order_id: 'ORD-1' },
    });

    expect(payload.external_reference).toBe('PAY-123');
    expect(payload.items[0].unit_price).toBe(1234.57);
    expect(payload.items[0].currency_id).toBe('ARS');
    expect(payload.auto_return).toBe('approved');
    expect(payload.metadata).toEqual({ order_id: 'ORD-1' });
  });

  it('normaliza los estados de Mercado Pago', () => {
    expect(normalizeMercadoPagoStatus('approved')).toBe('approved');
    expect(normalizeMercadoPagoStatus('in_process')).toBe('in_process');
    expect(normalizeMercadoPagoStatus('authorized')).toBe('in_process');
    expect(normalizeMercadoPagoStatus('refunded')).toBe('refunded');
    expect(normalizeMercadoPagoStatus('lo-que-sea')).toBe('unknown');
    expect(normalizeMercadoPagoStatus(null)).toBe('unknown');
  });

  it('valida la firma del webhook', () => {
    const secret = 'secreto-test';
    const dataId = '123456';
    const requestId = 'req-abc';
    const ts = '1700000000';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac('sha256', secret).update(manifest).digest('hex');

    expect(
      verifyMercadoPagoSignature({
        dataId,
        requestId,
        signature: `ts=${ts},v1=${v1}`,
        secret,
      }),
    ).toBe(true);

    expect(
      verifyMercadoPagoSignature({
        dataId,
        requestId,
        signature: `ts=${ts},v1=${'0'.repeat(64)}`,
        secret,
      }),
    ).toBe(false);

    expect(
      verifyMercadoPagoSignature({
        dataId,
        requestId,
        signature: null,
        secret,
      }),
    ).toBe(false);
  });
});
