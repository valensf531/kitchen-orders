/* Service worker mínimo: hace instalable la PWA sin cachear HTML/JS viejo. */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  /* Red primero: las pantallas operativas necesitan datos frescos. */
});
