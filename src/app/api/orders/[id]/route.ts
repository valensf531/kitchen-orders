import { NextRequest, NextResponse } from 'next/server';
import { orderStore } from '@/lib/store';
import { OrderStatus } from '@/types/order';
import { requireAccess } from '@/lib/access';
import { canCreateOrders, canOperateTables } from '@/lib/permissions';
import { logError } from '@/lib/log';
import { revalidateStats } from '@/lib/stats-cache';
import { freeTableIfEmpty } from '@/lib/order-ops';
import { cashSessionStore } from '@/lib/cash-session-store';
import { isPaymentMethod } from '@/lib/payments';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = access.restaurantId;

    const { id } = await params;
    const order = await orderStore.getById(id, userId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    logError('orders/[id].GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = access.restaurantId;

    const { id } = await params;
    const order = await orderStore.getById(id, userId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const body = await request.json();

    /* Cobro puntual de un pedido (p. ej. una cuenta huérfana sin mesa). */
    if (body.paid === true) {
      if (!canOperateTables(access.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (body.paymentMethod !== undefined && !isPaymentMethod(body.paymentMethod)) {
        return NextResponse.json({ error: 'Medio de pago inválido' }, { status: 400 });
      }
      const paymentMethod = isPaymentMethod(body.paymentMethod) ? body.paymentMethod : 'cash';
      const cashSession = await cashSessionStore.open(userId, {
        id: access.userId,
        name: access.name,
      });
      const paidOrder = await orderStore.markOrderPaid(id, userId, {
        paymentMethod,
        paidBy: access.userId,
        paidByName: access.name,
        cashSessionId: cashSession.id,
      });
      if (!paidOrder) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      await freeTableIfEmpty(paidOrder.userId, {
        id: paidOrder.tableId,
        number: paidOrder.tableNumber,
        zone: paidOrder.zone ?? null,
      });
      revalidateStats(paidOrder.userId);
      return NextResponse.json({ order: paidOrder });
    }
    
    if (body.itemDelivered !== undefined) {
      const { index, delivered } = body.itemDelivered;
      
      if (typeof index !== 'number' || typeof delivered !== 'boolean') {
        return NextResponse.json(
          { error: 'Invalid itemDelivered: requires number index and boolean delivered' },
          { status: 400 }
        );
      }
      
      const updatedOrder = await orderStore.updateItemDelivery(id, index, delivered, userId);

      if (!updatedOrder) {
        return NextResponse.json({ error: 'Order or item not found' }, { status: 404 });
      }

      revalidateStats(order.userId);

      return NextResponse.json({ order: updatedOrder });
    }

    if (!body.status) {
      return NextResponse.json(
        { error: 'Missing required field: status' },
        { status: 400 }
      );
    }

    const validStatuses: OrderStatus[] = ['received', 'processing', 'finished', 'canceled'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      );
    }

    const updatedOrder = await orderStore.updateStatus(id, body.status, userId, {
      id: access.userId,
      name: access.name,
    }, typeof body.reason === 'string' ? body.reason : undefined);

    if (!updatedOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    /* Al cancelar, si la mesa queda sin cuenta abierta se libera. */
    if (body.status === 'canceled') {
      await freeTableIfEmpty(order.userId, {
        id: order.tableId,
        number: order.tableNumber,
        zone: order.zone ?? null,
      });
    }

    revalidateStats(order.userId);

    return NextResponse.json({ order: updatedOrder });
  } catch (error) {
    logError('orders/[id].PATCH', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await requireAccess();
    if (!access) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = access.restaurantId;

    const { id } = await params;
    const order = await orderStore.getById(id, userId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    /* Borrar pedidos no es acción de cocina (ni tiene UI que lo use). */
    if (!canCreateOrders(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    /* Soft-delete: el pedido queda cancelado con actor y motivo (auditoría),
       no se borra físicamente. */
    const body = await request.json().catch(() => ({}));
    const deleted = await orderStore.updateStatus(id, 'canceled', userId, {
      id: access.userId,
      name: access.name,
    }, typeof body.reason === 'string' ? body.reason : 'Eliminado desde el panel');

    if (!deleted) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    /* Si era el último pedido de la mesa, la mesa queda libre. */
    await freeTableIfEmpty(order.userId, {
      id: order.tableId,
      number: order.tableNumber,
      zone: order.zone ?? null,
    });

    revalidateStats(order.userId);

    return NextResponse.json({ success: true, order: deleted });
  } catch (error) {
    logError('orders/[id].DELETE', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
