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

const SECOND_MS = 1_000;

// Um único intervalo de 1 s para todos os componentes inscritos: liga com o
// primeiro e desliga com o último (o relógio só roda com a tela aberta).
const secondListeners = new Set<() => void>();
let secondTimer: number | null = null;

function subscribeToSecond(onChange: () => void) {
  secondListeners.add(onChange);
  if (secondTimer === null) {
    secondTimer = window.setInterval(() => {
      for (const listener of secondListeners) listener();
    }, SECOND_MS);
  }
  return () => {
    secondListeners.delete(onChange);
    if (secondListeners.size === 0 && secondTimer !== null) {
      window.clearInterval(secondTimer);
      secondTimer = null;
    }
  };
}

function getSecondSnapshot(): number {
  return Math.floor(Date.now() / SECOND_MS) * SECOND_MS;
}

/**
 * Timestamp (ms) do segundo atual no cliente, atualizado a cada segundo, para
 * tempos relativos e contagens regressivas (ex.: painel do pedido no admin).
 * É `null` no servidor e durante a hidratação, como `useClientMinute`. Os
 * componentes inscritos compartilham um único intervalo, ligado só enquanto há
 * algum montado.
 */
export function useClientSecond(): number | null {
  return useSyncExternalStore(subscribeToSecond, getSecondSnapshot, getServerSnapshot);
}
