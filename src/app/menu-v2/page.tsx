import type { Metadata } from 'next';
import { Fraunces } from 'next/font/google';
import { MenuV2View } from '@/components/MenuV2View';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-editorial',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vista previa · Carta digital',
  description: 'Propuesta de rediseño del menú digital.',
  robots: { index: false, follow: false },
};

export default function MenuV2Page() {
  return (
    <div className={fraunces.variable}>
      <MenuV2View />
    </div>
  );
}
