'use client';

import { useSyncExternalStore } from 'react';

const MINUTE_MS = 60_000;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, MINUTE_MS);
  return () => window.clearInterval(id);
}

function getSnapshot(): number {
  return Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
}

function getServerSnapshot(): number | null {
  return null;
}

/**
 * Timestamp (ms) do minuto atual no cliente, atualizado a cada minuto.
 * É `null` no servidor e durante a hidratação, para o HTML inicial não
 * depender do relógio: quem consome renderiza a estrutura e preenche depois.
 */
export function useClientMinute(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
