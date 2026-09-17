'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { getOrdersSummary, type OrdersSummary } from './admin-order.api';
import { useLiveRefetch, type LiveLoad } from './use-live-refetch.hook';

/**
 * Toaster único do resumo: o contador do menu e o dashboard leem o resumo ao
 * mesmo tempo, e uma falha não deve aparecer duas vezes.
 */
const SUMMARY_ERROR_TOAST_ID = 'orders-summary-error';

type SummaryState = {
  /** Token da sessão que produziu o estado: outra sessão o invalida. */
  token: string;
  summary: OrdersSummary | null;
};

/**
 * Resumo do dia da operação (`GET /orders/summary`), relido ao vivo a cada aviso
 * do stream administrativo e a cada reconexão (`useLiveRefetch`).
 *
 * - `summary` é `null` enquanto a primeira leitura da sessão não respondeu ou
 *   quando ela falhou; `loading` vale `true` só antes da primeira resposta.
 * - Releitura que falha mantém o resumo exibido; a falha vira um toaster (sem
 *   repetir enquanto o mesmo aviso estiver na tela).
 */
export function useOrdersSummary() {
  const { session } = useAuth();
  const token = session?.token;
  const [state, setState] = useState<SummaryState | null>(null);

  const load = useCallback<LiveLoad>(
    async (isCurrent) => {
      if (!token) return;
      try {
        const summary = await getOrdersSummary(token);
        if (isCurrent()) setState({ token, summary });
      } catch (error: unknown) {
        if (!isCurrent()) return;
        toast.error(toErrorMessage(error), { id: SUMMARY_ERROR_TOAST_ID });
        setState((previous) => (previous?.token === token ? previous : { token, summary: null }));
      }
    },
    [token],
  );

  useLiveRefetch(token ? load : null);

  const current = token && state?.token === token ? state : null;

  return {
    summary: current?.summary ?? null,
    loading: Boolean(token) && current === null,
  };
}
