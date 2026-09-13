'use client';

import { useSyncExternalStore } from 'react';

const subscribeToNothing = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` no servidor e durante a hidratação, `true` logo depois. Serve para
 * estado que só existe no navegador (sessão lida do cookie, carrinho salvo)
 * não divergir do HTML inicial: renderize o estado "sem sessão" até hidratar.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, getClientSnapshot, getServerSnapshot);
}
