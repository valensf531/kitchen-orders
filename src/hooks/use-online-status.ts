'use client';

import { useEffect, useState } from 'react';

/* Estado de conexión del navegador, para avisar cuando se pierde la red. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    /* Tras hidratar: sincroniza el estado inicial sin mismatch de SSR. */
    const sync = () => setOnline(navigator.onLine);
    const timeout = setTimeout(sync, 0);
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  return online;
}
