import type { Metadata } from 'next';
import { Sora } from 'next/font/google';
import { MenuCafeView } from '@/components/MenuCafeView';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-cafe',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vista previa · Cafetería',
  description: 'Propuesta de menú moderno para cafeterías.',
  robots: { index: false, follow: false },
};

export default function MenuCafePage() {
  return (
    <div className={sora.variable}>
      <MenuCafeView />
    </div>
  );
}
