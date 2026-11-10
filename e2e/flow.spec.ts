import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect, request as playwrightRequest } from '@playwright/test';

type Seed = {
  restaurantId: string;
  ownerEmail: string;
  ownerPassword: string;
  kitchenEmail: string;
  kitchenPassword: string;
  zone: string;
  tableId: string;
  tableNumber: number;
  tableToken: string;
  menuItemId: string;
  menuItemName: string;
  menuItemPrice: number;
};

const seed: Seed = JSON.parse(readFileSync(resolve('e2e/seed.json'), 'utf8'));
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

async function signIn(context: Awaited<ReturnType<typeof playwrightRequest.newContext>>, email: string, password: string) {
  const response = await context.post('/api/auth/sign-in/email', {
    data: { email, password },
    /* Better Auth valida el origen en los POST de auth. */
    headers: { Origin: baseURL },
  });
  expect(response.ok(), `login ${email}`).toBeTruthy();
}

function orderPayload(idempotencyKey: string) {
  return {
    restaurantId: seed.restaurantId,
    tableId: seed.tableId,
    tableNumber: seed.tableNumber,
    zone: seed.zone,
    tableToken: seed.tableToken,
    idempotencyKey,
    customerName: 'Cliente E2E',
    items: [{ id: seed.menuItemId, quantity: 2 }],
  };
}

test('QR → cocina → caja → mesa libre → estadísticas', async ({ request }) => {
  await signIn(request, seed.ownerEmail, seed.ownerPassword);

  const access = await request.get('/api/access');
  expect(access.ok()).toBeTruthy();
  expect((await access.json()).restaurantId).toBe(seed.restaurantId);

  const menuResponse = await request.get(
    `/api/public/menu?restaurant=${encodeURIComponent(seed.restaurantId)}`,
  );
  expect(menuResponse.ok()).toBeTruthy();
  const menu = await menuResponse.json();
  expect(menu.items.some((item: { id: string }) => item.id === seed.menuItemId)).toBeTruthy();

  const idempotencyKey = `e2e-${Date.now()}`;
  const created = await request.post('/api/public/menu', {
    data: orderPayload(idempotencyKey),
  });
  expect(created.status()).toBe(201);
  const { order } = await created.json();
  expect(order.total).toBe(seed.menuItemPrice * 2);
  expect(order.status).toBe('received');

  /* Reintento de red: el mismo idempotencyKey no duplica el pedido. */
  const retried = await request.post('/api/public/menu', {
    data: orderPayload(idempotencyKey),
  });
  expect(retried.status()).toBe(200);
  const retriedBody = await retried.json();
  expect(retriedBody.duplicate).toBe(true);
  expect(retriedBody.order.id).toBe(order.id);

  const tablesAfterOrder = await (await request.get('/api/tables')).json();
  const occupiedTable = tablesAfterOrder.tables.find(
    (table: { id: string }) => table.id === seed.tableId,
  );
  expect(occupiedTable.status).toBe('occupied');

  const kitchen = await playwrightRequest.newContext({
    baseURL,
  });
  try {
    await signIn(kitchen, seed.kitchenEmail, seed.kitchenPassword);
    const started = await kitchen.patch(`/api/orders/${order.id}`, {
      data: { status: 'processing' },
    });
    expect(started.ok()).toBeTruthy();
    expect((await started.json()).order.startedByName).toBe('E2E Cocinero');

    const finished = await kitchen.patch(`/api/orders/${order.id}`, {
      data: { status: 'finished' },
    });
    expect(finished.ok()).toBeTruthy();
    expect((await finished.json()).order.finishedAt).toBeTruthy();
  } finally {
    await kitchen.dispose();
  }

  const paid = await request.patch(`/api/tables/${seed.tableId}`, {
    data: { closeAccount: true, paymentMethod: 'cash' },
  });
  expect(paid.ok()).toBeTruthy();

  const tablesAfterPay = await (await request.get('/api/tables')).json();
  const freeTable = tablesAfterPay.tables.find(
    (table: { id: string }) => table.id === seed.tableId,
  );
  expect(freeTable.status).toBe('available');

  const cash = await (await request.get('/api/cash-sessions')).json();
  expect(cash.session?.status).toBe('open');
  expect(cash.summary.total).toBe(seed.menuItemPrice * 2);
  expect(cash.summary.cashTotal).toBe(seed.menuItemPrice * 2);

  const from = new Date(Date.now() - 3_600_000).toISOString();
  const to = new Date(Date.now() + 3_600_000).toISOString();
  const statsResponse = await request.get(
    `/api/stats?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  expect(statsResponse.ok(), await statsResponse.text()).toBeTruthy();
  const stats = await statsResponse.json();
  expect(stats.summary.orders).toBeGreaterThanOrEqual(1);
  expect(stats.summary.collected).toBeGreaterThanOrEqual(seed.menuItemPrice * 2);
  expect(stats.summary.revenue).toBeGreaterThanOrEqual(seed.menuItemPrice * 2);
  expect(stats.summary.pending).toBe(0);
  expect(
    stats.paymentMethods.some(
      (method: { method: string; total: number }) =>
        method.method === 'cash' && method.total >= seed.menuItemPrice * 2,
    ),
  ).toBeTruthy();
  expect(stats.salesByDay.length).toBeGreaterThan(0);
});

test('el pago online queda deshabilitado sin credenciales de Mercado Pago', async ({
  request,
}) => {
  const menu = await (
    await request.get(
      `/api/public/menu?restaurant=${encodeURIComponent(seed.restaurantId)}`,
    )
  ).json();
  expect(menu.onlinePaymentsEnabled).toBe(false);

  const response = await request.post('/api/public/payments', {
    data: {
      restaurantId: seed.restaurantId,
      orderId: 'ORD-inexistente',
      tableToken: seed.tableToken,
    },
  });
  expect(response.status()).toBe(503);
});

test('cancelar deja motivo y actor (soft-delete)', async ({ request }) => {
  await signIn(request, seed.ownerEmail, seed.ownerPassword);

  const created = await request.post('/api/public/menu', {
    data: orderPayload(`e2e-cancel-${Date.now()}`),
  });
  expect(created.status()).toBe(201);
  const { order } = await created.json();

  const canceled = await request.patch(`/api/orders/${order.id}`, {
    data: { status: 'canceled', reason: 'Cliente se fue' },
  });
  expect(canceled.ok()).toBeTruthy();
  const canceledOrder = (await canceled.json()).order;
  expect(canceledOrder.status).toBe('canceled');
  expect(canceledOrder.cancelReason).toBe('Cliente se fue');
  expect(canceledOrder.canceledByName).toBe('E2E Dueño');
  expect(canceledOrder.canceledAt).toBeTruthy();

  const fetched = await (await request.get(`/api/orders/${order.id}`)).json();
  expect(fetched.order.cancelReason).toBe('Cliente se fue');
});
