import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/* Auth intencionalmente por ruta (cada API valida sesión + user_id en SQL).
   No activar redirect global aquí: rompería /menu QR público y /api/public/*,
   además de /api/auth/* y assets. */
export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-url', request.url);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
