import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Lumen Kitchen',
    short_name: 'Lumen',
    description: 'Gestión de pedidos, cocina, salón y caja para restaurantes.',
    start_url: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fffbf7',
    theme_color: '#0f766e',
    icons: [
      {
        src: '/logo.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
