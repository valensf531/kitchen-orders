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
  console.log('AUTH GET request:', request.nextUrl.pathname);
  try {
    const handlers = await getHandlers();
    const response = await handlers.GET(request);
    console.log('AUTH GET response status:', response.status);
    return response;
  } catch (error) {
    console.error('AUTH GET error:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  console.log('AUTH POST request:', request.nextUrl.pathname);
  try {
    const handlers = await getHandlers();
    const response = await handlers.POST(request);
    console.log('AUTH POST response status:', response.status);
    return response;
  } catch (error) {
    console.error('AUTH POST error:', error);
    throw error;
  }
}
