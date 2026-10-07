import { NextRequest, NextResponse } from 'next/server';
import { tableStore } from '@/lib/table-store';
import { orderStore } from '@/lib/store';
import { TableStatus } from '@/types/table';
import { validateManualTableStatusChange } from '@/lib/table-status';
import { canOperateTables } from '@/lib/permissions';
import { requireAccess, requireAdmin } from '@/lib/access';
import { revalidatePublicMenu } from '@/lib/menu-cache';
import { revalidateStats } from '@/lib/stats-cache';

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
    const table = await tableStore.getById(userId, id);
    
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ table });
  } catch (error) {
    console.error('Failed to fetch table:', error);
    return NextResponse.json(
      { error: 'Failed to fetch table' },
      { status: 500 }
    );
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
    const body = await request.json();
    const { number, status, position, shape, seats, itemDelivered, closeAccount } = body;

    /* Cambio estructural (número, forma, lugares, posición): solo admin.
       Cambio operativo (estado, cierre de cuenta): vendedor y admin.
       Cocina no toca mesas (ni siquiera operativo). */
    const isStructural =
      number !== undefined || position !== undefined || shape !== undefined || seats !== undefined;
    if (isStructural && !access.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!isStructural && !canOperateTables(access.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (itemDelivered) {
      return NextResponse.json(
        { error: 'itemDelivered is not supported for tables' },
        { status: 400 }
      );
    }
    
    const updateData: { 
      number?: number; 
      status?: TableStatus;
      position?: { x: number; y: number };
      shape?: 'circle' | 'square' | 'rectangle';
      seats?: number;
    } = {};

    const currentTable = await tableStore.getById(userId, id);
    if (!currentTable) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    if (closeAccount) {
      await orderStore.closeTableAccount(userId, currentTable.number, currentTable.zone);
      updateData.status = 'available';
      revalidateStats(userId);
    }

    /* Cambio manual de estado con cuenta abierta: no se puede liberar ni
       dar por pagada a mano (se cobra en Caja). 422 con mensaje claro. */
    if (status !== undefined && !closeAccount) {
      const validStatuses: TableStatus[] = ['available', 'occupied', 'pending_payment', 'paid'];
      if (!validStatuses.includes(status as TableStatus)) {
        return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
      }
      const hasOpen = await orderStore.hasOpenOrders(userId, currentTable.number, currentTable.zone);
      const blocked = validateManualTableStatusChange({
        targetStatus: status as TableStatus,
        hasOpenOrders: hasOpen,
        closeAccount: false,
      });
      if (blocked) {
        return NextResponse.json({ error: blocked }, { status: 422 });
      }
    }
    
    if (number !== undefined) updateData.number = number;
    if (status !== undefined) updateData.status = status as TableStatus;
    if (position !== undefined) updateData.position = position;
    if (shape !== undefined) updateData.shape = shape;
    if (seats !== undefined) updateData.seats = seats;
    
    const table = await tableStore.update(userId, id, updateData);
    
    if (!table) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    revalidatePublicMenu(userId);

    return NextResponse.json({ table });
  } catch (error) {
    console.error('Failed to update table:', error);
    if (error instanceof Error && error.message.includes('Ya existe')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update table' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = admin.restaurantId;

    const { id } = await params;
    const deleted = await tableStore.delete(userId, id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Table not found' },
        { status: 404 }
      );
    }

    revalidatePublicMenu(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete table:', error);
    return NextResponse.json(
      { error: 'Failed to delete table' },
      { status: 500 }
    );
  }
}
