'use client';

import { useEffect, useRef } from 'react';

/* Beep sintetizado con Web Audio: no requiere archivo de audio. */
function playBeep() {
  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    const now = ctx.currentTime;
    for (const offset of [0, 0.18]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    }
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* autoplay bloqueado por el navegador: se habilita al interactuar. */
  }
}

/*
 * Suena cuando llega un pedido nuevo. Recibe la lista de ids como clave
 * (string estable) para no depender de identidades de arrays.
 */
export function useNewOrderSound(ordersKey: string, enabled: boolean) {
  const previousKey = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      previousKey.current = ordersKey;
      return;
    }
    if (previousKey.current === null) {
      /* La primera carga no suena: evita un beep al abrir la pantalla. */
      previousKey.current = ordersKey;
      return;
    }
    if (ordersKey !== previousKey.current) {
      const previous = new Set(previousKey.current.split(',').filter(Boolean));
      const hasNew = ordersKey.split(',').some((id) => id && !previous.has(id));
      if (hasNew) playBeep();
      previousKey.current = ordersKey;
    }
  }, [ordersKey, enabled]);
}
