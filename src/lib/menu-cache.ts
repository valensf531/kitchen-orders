import { revalidateTag } from 'next/cache';

/* Tag de caché del menú público por restaurante. */
export function publicMenuTag(userId: string) {
  return `public-menu:${userId}`;
}

/* Invalida el menú público cuando cambia cualquier dato que expone. */
export function revalidatePublicMenu(userId: string) {
  revalidateTag(publicMenuTag(userId), 'max');
}
