import { NextRequest, NextResponse } from 'next/server';
import { getMercadoPagoPayment, verifyMercadoPagoSignature } from '@/lib/mercadopago';
import { applyMercadoPagoPayment } from '@/lib/payment-ops';
import { logError, logWarn } from '@/lib/log';

/* Webhook de Mercado Pago. Responde 200 rápido y deja el pago conciliado.
   Si MERCADOPAGO_WEBHOOK_SECRET está definido, valida la firma x-signature. */
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const type =
      body?.type ?? url.searchParams.get('type') ?? url.searchParams.get('topic');
    const dataId =
      body?.data?.id ?? url.searchParams.get('data.id') ?? url.searchParams.get('id');

    if (type && type !== 'payment') {
      return NextResponse.json({ ok: true, ignored: true });
    }
    if (dataId === null || dataId === undefined || String(dataId).length === 0) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
    if (secret) {
      const valid = verifyMercadoPagoSignature({
        dataId: String(dataId),
        requestId: request.headers.get('x-request-id'),
        signature: request.headers.get('x-signature'),
        secret,
      });
      if (!valid) {
        logWarn('webhooks.mercadopago', 'Firma inválida');
        return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
      }
    }

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const mpPayment = await getMercadoPagoPayment(String(dataId));
    const payment = await applyMercadoPagoPayment(mpPayment);
    return NextResponse.json({ ok: true, paymentId: payment?.id ?? null });
  } catch (error) {
    logError('webhooks.mercadopago', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
