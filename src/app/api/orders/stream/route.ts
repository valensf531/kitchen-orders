import { NextRequest } from 'next/server';
import { requireAccess } from '@/lib/access';
import { orderStore } from '@/lib/store';
import { logError } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/*
 * SSE para las pantallas operativas: cuando cambia la versión de las órdenes
 * se envía la lista activa completa. Si el proxy corta la conexión, el cliente
 * vuelve al polling normal como respaldo.
 */
export async function GET(request: NextRequest) {
  const access = await requireAccess();
  if (!access) {
    return new Response('Unauthorized', { status: 401 });
  }
  const userId = access.restaurantId;
  const encoder = new TextEncoder();

  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const stop = () => {
        if (closed) return;
        closed = true;
        if (tickTimer) clearInterval(tickTimer);
        if (pingTimer) clearInterval(pingTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      let lastVersion = '';
      const tick = async () => {
        if (closed) return;
        try {
          const version = await orderStore.getVersion(userId);
          if (version === lastVersion) return;
          lastVersion = version;
          const orders = await orderStore.getAll(userId, { activeOnly: true });
          send(`event: orders\ndata: ${JSON.stringify({ orders })}\n\n`);
        } catch (error) {
          logError('orders.stream.tick', error);
        }
      };

      send('retry: 5000\n\n');
      await tick();
      if (closed) return;
      tickTimer = setInterval(() => void tick(), 3000);
      pingTimer = setInterval(() => send(': ping\n\n'), 15000);
      request.signal.addEventListener('abort', stop, { once: true });
      if (request.signal.aborted) stop();
    },
    cancel() {
      if (tickTimer) clearInterval(tickTimer);
      if (pingTimer) clearInterval(pingTimer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
