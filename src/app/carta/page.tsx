import type { Metadata } from 'next';
import { CartaView } from '@/components/CartaView';

/* Vitrina pública de solo lectura: pensada para compartir en Instagram o
   WhatsApp. No pide mesa ni toma pedidos (eso vive en /menu). */
export const metadata: Metadata = {
  title: 'Nuestra carta',
  description: 'Mirá la carta: platos, precios y fotos.',
  openGraph: {
    title: 'Nuestra carta 🍽️',
    description: 'Platos, precios y fotos.',
    type: 'website',
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary',
    title: 'Nuestra carta 🍽️',
    description: 'Platos, precios y fotos.',
    images: ['/logo.png'],
  },
};

export default function CartaPage() {
  return <CartaView />;
}
