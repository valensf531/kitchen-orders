'use client';

import { useEffect } from 'react';

type WakeLockSentinelLike = { release: () => Promise<void> };

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

/*
 * Mantiene la pantalla despierta en tablets de cocina/caja. Si el navegador
 * no soporta Wake Lock o el usuario lo bloquea, no rompe nada.
 */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const request = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        sentinel = await nav.wakeLock?.request('screen') ?? null;
      } catch {
        /* sin permiso o en segundo plano */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [enabled]);
}
