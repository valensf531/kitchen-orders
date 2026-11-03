import { getAuth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import type { NextRequest } from 'next/server';

let _handlers: ReturnType<typeof toNextJsHandler> | undefined;

async function getHandlers() {
  if (!_handlers) {
    const auth = getAuth();
    _handlers = toNextJsHandler(auth);
  }
  return _handlers;
}

export async function GET(request: NextRequest) {
  try {
    const handlers = await getHandlers();
    return await handlers.GET(request);
  } catch (error) {
    console.error('AUTH GET error:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const handlers = await getHandlers();
    return await handlers.POST(request);
  } catch (error) {
    console.error('AUTH POST error:', error);
    throw error;
  }
}
