import { NextResponse } from 'next/server';
import { menuStore } from '@/lib/menu-store';

/* Cache agresivo: la URL incluye la versión del item (?v=updatedAt),
   así el navegador solo la descarga una vez por foto. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const restaurant = new URL(request.url).searchParams.get('restaurant') ?? undefined;
    const image = await menuStore.getItemImage(id, restaurant ?? undefined);

    if (!image) {
      return new NextResponse('Not found', { status: 404 });
    }

    /* Fotos históricas guardadas como URL externa. */
    if (/^https?:\/\//i.test(image)) {
      return NextResponse.redirect(image);
    }

    if (image.startsWith('data:')) {
      // Límite ~4MB de data URL para evitar picos de memoria en serverless.
      if (image.length > 4_000_000) {
        return new NextResponse('Image too large', { status: 413 });
      }
      const commaIndex = image.indexOf(',');
      if (commaIndex === -1) {
        return new NextResponse('Not found', { status: 404 });
      }
      const header = image.slice(5, commaIndex);
      if (!header.includes('base64')) {
        return new NextResponse('Not found', { status: 404 });
      }
      const mime = (header.split(';', 1)[0] || 'image/jpeg').toLowerCase();
      if (!ALLOWED_IMAGE_MIME.has(mime)) {
        return new NextResponse('Not found', { status: 404 });
      }
      const buffer = Buffer.from(image.slice(commaIndex + 1), 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': IMMUTABLE_CACHE,
        },
      });
    }

    return new NextResponse('Not found', { status: 404 });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
