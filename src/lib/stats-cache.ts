import { revalidateTag } from 'next/cache';

/* Tag de caché de estadísticas por restaurante. */
export function statsTag(userId: string) {
  return `stats:${userId}`;
}

/* Invalida las estadísticas cuando cambia una orden (creación, estado o cobro). */
export function revalidateStats(userId: string) {
  revalidateTag(statsTag(userId), 'max');
}
