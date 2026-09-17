'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { openEventStream, type EventStreamStatus } from '@/shared/util/event-stream.util';
import { createCoalescedRead } from './coalesced-read.util';
import { isOrderFinished } from './order-status.util';
import { getMyOrder, myOrderStreamPath, type OrderDetail } from './order.api';

/** Evento do stream do pedido que avisa uma mudança (o `ping` nem chega ao hook). */
const ORDER_STREAM_EVENT = 'order';

/**
 * Atualização ao vivo do pedido: o estado do stream (`EventStreamStatus`) ou
 * `off` quando não há stream (sem pedido carregado ou pedido entregue).
 */
export type MyOrderLiveStatus = EventStreamStatus | 'off';

type MyOrderState = {
  /** Token da sessão e id do pedido que produziram o estado: outra sessão ou outro id o invalidam. */
  token: string;
  orderId: string;
  order: OrderDetail | null;
  notFound: boolean;
};

type LiveState = {
  /** Mesma chave de `MyOrderState`: o estado do stream de outra sessão ou outro id não vale. */
  token: string;
  orderId: string;
  status: EventStreamStatus;
};

/**
 * Pedido `orderId` do usuário da sessão, para o acompanhamento, atualizado ao vivo.
 *
 * - O estado é chaveado pelo token e pelo id: sem sessão `order` é `null` sem
 *   chamar a API, e entrar com outra conta consulta de novo. `loading` vale
 *   `true` enquanto o pedido da sessão atual não foi consultado; `notFound`
 *   quando a API responde `404 ORDER_NOT_FOUND` (inclusive pedido de outro
 *   usuário). Erro na primeira leitura vira toaster e deixa `order` `null` com
 *   `notFound` `false`.
 * - Com o pedido carregado e ainda não entregue, abre o stream de avisos
 *   (`openEventStream` em `myOrderStreamPath`, token no cabeçalho). O aviso não
 *   traz dados: o pedido é relido por `GET /me/orders/:id`, a fonte da verdade, a
 *   cada evento `order` e a cada vez que o stream fica `live` (ao abrir, o que
 *   cobre o que mudou entre a primeira leitura e o stream, e ao voltar de
 *   `reconnecting`), com no máximo uma leitura em andamento e uma pendente.
 * - `live` expõe o estado do stream (`connecting`, `live`, `reconnecting`,
 *   `closed`) ou `off` sem stream (pedido entregue, não encontrado ou não carregado).
 * - O stream fecha ao desmontar, ao trocar de sessão ou de id e quando o pedido
 *   chega a `DELIVERED`.
 * - Releitura que falha mantém o pedido exibido. Um erro diferente de `404` vira
 *   **um** toaster por queda: os seguintes ficam em silêncio até uma releitura dar certo.
 * - `reload()` relê o pedido da sessão atual, pelas mesmas regras.
 */
export function useMyOrder(orderId: string) {
  const { session } = useAuth();
  const token = session?.token;

  const [state, setState] = useState<MyOrderState | null>(null);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  // Leitor da sessão e do id atuais, usado pelo stream e por `reload`.
  const readRef = useRef<(() => void) | null>(null);

  const current = token && state?.token === token && state.orderId === orderId ? state : null;
  const order = current?.order ?? null;
  const shouldStream = Boolean(token) && order !== null && !isOrderFinished(order);

  // Até o primeiro estado do stream desta sessão e deste id chegar, o stream está sendo aberto.
  const currentLive = liveState && liveState.token === token && liveState.orderId === orderId ? liveState.status : 'connecting';
  const live: MyOrderLiveStatus = shouldStream ? currentLive : 'off';

  useEffect(() => {
    if (!token) return;

    // `cancelled`: a resposta de uma leitura em andamento ao trocar de sessão ou de id é descartada.
    let cancelled = false;
    let loaded = false;
    let errorNotified = false;

    const reader = createCoalescedRead(async () => {
      try {
        const next = await getMyOrder(token, orderId);
        if (cancelled) return;
        loaded = true;
        errorNotified = false;
        setState({ token, orderId, order: next, notFound: next === null });
      } catch (error: unknown) {
        if (cancelled) return;
        if (!loaded) {
          // Primeira leitura: não há pedido para manter na tela.
          loaded = true;
          toast.error(toErrorMessage(error));
          setState({ token, orderId, order: null, notFound: false });
          return;
        }
        if (!errorNotified) {
          errorNotified = true;
          toast.error(toErrorMessage(error));
        }
      }
    });

    readRef.current = reader.run;
    reader.run();

    return () => {
      cancelled = true;
      reader.stop();
      if (readRef.current === reader.run) readRef.current = null;
    };
  }, [token, orderId]);

  useEffect(() => {
    if (!token || !shouldStream) return;

    return openEventStream({
      path: myOrderStreamPath(orderId),
      token,
      onEvent: (event) => {
        if (event.type === ORDER_STREAM_EVENT) readRef.current?.();
      },
      onStatusChange: (status) => {
        setLiveState({ token, orderId, status });
        if (status === 'live') readRef.current?.();
      },
    });
  }, [token, orderId, shouldStream]);

  const reload = useCallback(() => readRef.current?.(), []);

  return {
    order,
    loading: Boolean(token) && current === null,
    notFound: current?.notFound ?? false,
    live,
    reload,
  };
}
