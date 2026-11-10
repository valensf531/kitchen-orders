import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { orderStore } from '@/lib/store';
import { paymentStore } from '@/lib/payment-store';
import { brandingStore } from '@/lib/branding-store';
import { verifyTableToken } from '@/lib/table-token';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  createMercadoPagoPreference,
  mercadopagoConfigured,
  publicBaseUrl,
} from '@/lib/mercadopago';
import { logError } from '@/lib/log';

const PENDING_MAX_AGE_MS = 30 * 60_000;

/* Crea (o reutiliza) una preferencia de Checkout Pro para pagar un pedido
   público. Devuelve el link y un QR generado por nosotros. */
export async function POST(request: NextRequest) {
  try {
    if (!mercadopagoConfigured()) {
      return NextResponse.json(
        { error: 'El pago online no está habilitado. Podés pagar en caja.' },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => null);
    const userId = typeof body?.restaurantId === 'string' ? body.restaurantId : '';
    const orderId = typeof body?.orderId === 'string' ? body.orderId : '';
    if (!userId || !orderId) {
      return NextResponse.json({ error: 'Faltan datos del pedido' }, { status: 400 });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    const limit = checkRateLimit(`public-pay:${ip}:${userId}`, 20, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Demasiados intentos de pago. Esperá un momento.' },
        { status: 429 },
      );
    }

    const order = await orderStore.getById(orderId, userId);
    if (!order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    if (order.paidAt) {
      return NextResponse.json(
        { error: 'Este pedido ya está pagado', paid: true },
        { status: 409 },
      );
    }
    if (order.status === 'canceled') {
      return NextResponse.json({ error: 'Este pedido fue cancelado' }, { status: 400 });
    }
    if (!order.tableId || order.tableNumber == null) {
      return NextResponse.json(
        { error: 'El pedido no tiene una mesa asociada' },
        { status: 400 },
      );
    }
    if (
      !verifyTableToken(body?.tableToken, {
        restaurantId: userId,
        tableId: order.tableId,
        tableNumber: Number(order.tableNumber),
        zone: String(order.zone ?? ''),
      })
    ) {
      return NextResponse.json(
        { error: 'QR inválido. Escaneá el QR de tu mesa para pagar.' },
        { status: 403 },
      );
    }

    let payment = await paymentStore.getPendingByOrderId(userId, orderId);
    if (
      payment &&
      (!payment.initPoint ||
        Date.now() - new Date(payment.createdAt).getTime() > PENDING_MAX_AGE_MS)
    ) {
      await paymentStore.update(payment.id, { status: 'cancelled' });
      payment = undefined;
    }

    let initPoint = payment?.initPoint;
    if (!payment) {
      const branding = await brandingStore.getByUserId(userId).catch(() => null);
      const currency = branding?.currencyCode ?? 'ARS';
      payment = await paymentStore.create({
        userId,
        orderId,
        amount: order.total,
        currency,
      });
      const base = publicBaseUrl();
      const backBase = `${base}/menu?restaurant=${encodeURIComponent(userId)}&order=${encodeURIComponent(order.id)}`;
      const notificationUrl =
        process.env.MERCADOPAGO_NOTIFICATION_URL || `${base}/api/webhooks/mercadopago`;
      try {
        const preference = await createMercadoPagoPreference({
          paymentId: payment.id,
          orderId: order.id,
          title: `Pedido #${order.displayNumber ?? order.id} - ${branding?.name || 'Restaurante'}`,
          amount: order.total,
          currencyId: currency,
          notificationUrl,
          backUrls: {
            success: `${backBase}&payment=success`,
            failure: `${backBase}&payment=failure`,
            pending: `${backBase}&payment=pending`,
          },
          metadata: {
            payment_id: payment.id,
            order_id: order.id,
            restaurant_id: userId,
          },
        });
        initPoint = preference.init_point || preference.sandbox_init_point || '';
        payment =
          (await paymentStore.update(payment.id, {
            preferenceId: preference.id,
            initPoint,
            status: 'pending',
          })) ?? payment;
      } catch (error) {
        logError('public-payments.createPreference', error);
        await paymentStore.update(payment.id, {
          status: 'cancelled',
          statusDetail: 'No se pudo crear la preferencia',
        });
        return NextResponse.json(
          { error: 'No se pudo generar el pago. Intentá de nuevo.' },
          { status: 502 },
        );
      }
    }

    if (!initPoint) {
      return NextResponse.json(
        { error: 'No se pudo generar el QR de pago. Intentá de nuevo.' },
        { status: 502 },
      );
    }

    const qrDataUrl = await QRCode.toDataURL(initPoint, { width: 480, margin: 1 });

    return NextResponse.json({
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        orderId: payment.orderId,
        initPoint,
        qrDataUrl,
      },
    });
  } catch (error) {
    logError('public-payments.POST', error);
    return NextResponse.json(
      { error: 'No se pudo iniciar el pago' },
      { status: 500 },
    );
  }
}
