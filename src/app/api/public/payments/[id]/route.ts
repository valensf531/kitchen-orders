import { NextRequest, NextResponse } from 'next/server';
import { paymentStore } from '@/lib/payment-store';
import {
  getMercadoPagoPayment,
  mercadopagoConfigured,
  searchMercadoPagoPayment,
} from '@/lib/mercadopago';
import { applyMercadoPagoPayment } from '@/lib/payment-ops';
import { logError } from '@/lib/log';
import type { Payment } from '@/types/payment';

function toPublic(payment: Payment) {
  return {
    id: payment.id,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    orderId: payment.orderId,
    paidAt: payment.paidAt,
    initPoint: payment.initPoint,
  };
}

/* Estado público de un pago. Si sigue pendiente, intenta conciliarlo con
   Mercado Pago (el webhook puede no llegar en local o demorar). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    let payment = await paymentStore.getById(id);
    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 });
    }

    if (
      (payment.status === 'pending' || payment.status === 'in_process') &&
      mercadopagoConfigured()
    ) {
      try {
        const mpPayment = payment.mpPaymentId
          ? await getMercadoPagoPayment(payment.mpPaymentId)
          : payment.preferenceId
            ? await searchMercadoPagoPayment(payment.id)
            : null;
        if (mpPayment) {
          payment = (await applyMercadoPagoPayment(mpPayment)) ?? payment;
        }
      } catch (error) {
        /* El polling no debe fallar por un error temporal de Mercado Pago. */
        logError('public-payments.sync', error);
      }
    }

    return NextResponse.json(
      { payment: toPublic(payment) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    logError('public-payments.GET', error);
    return NextResponse.json(
      { error: 'No se pudo consultar el pago' },
      { status: 500 },
    );
  }
}
