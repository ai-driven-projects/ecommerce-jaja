'use client';

import { useCallback, useEffect, useState } from 'react';
import { isGoogleMapsConfigured } from './google-maps.config';

/** `window.gm_authFailure`: o Google chama essa função global quando recusa a chave. */
type GoogleMapsAuthWindow = Window & { gm_authFailure?: () => void };

/**
 * Detecta a falha do Google Maps para a tela cair no mapa simulado:
 * `handleLoadError` vai no `onError` do `APIProvider` (script não carregou) e,
 * enquanto `enabled` (padrão: há chave pública) for verdadeiro e nada falhou,
 * `window.gm_authFailure` (chave recusada) é encadeado ao handler anterior e
 * restaurado ao desmontar. `loadFailed` fica `true` depois de qualquer uma das
 * falhas.
 */
export function useGoogleMapsLoadFailure(enabled: boolean = isGoogleMapsConfigured) {
  const [loadFailed, setLoadFailed] = useState(false);

  const handleLoadError = useCallback(() => setLoadFailed(true), []);

  // Chave recusada: o Google chama `gm_authFailure` depois de carregar o script.
  useEffect(() => {
    if (!enabled || loadFailed) return;

    const authWindow = window as GoogleMapsAuthWindow;
    const previous = authWindow.gm_authFailure;
    authWindow.gm_authFailure = () => {
      previous?.();
      setLoadFailed(true);
    };

    return () => {
      authWindow.gm_authFailure = previous;
    };
  }, [enabled, loadFailed]);

  return { loadFailed, handleLoadError };
}
