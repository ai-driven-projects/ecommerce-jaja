'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/modules/auth/data/auth.context';
import { openEventStream, type EventStreamStatus } from '@/shared/util/event-stream.util';
import { ORDERS_STREAM_PATH } from './admin-order.api';
import type { OrderStreamNotice } from './order.api';

/** Evento do stream administrativo que avisa um evento de pedido (o `ping` nem chega aqui). */
const ORDER_STREAM_EVENT = 'order';

/**
 * Aviso entregue a quem se inscreve:
 * - `OrderStreamNotice`: um evento de algum pedido foi publicado (sem dados do pedido);
 * - `{ reconnected: true }`: sintético, quando o stream volta a `live` depois de
 *   `reconnecting`. Avisos da queda podem ter sido perdidos: quem recebe relê tudo.
 */
export type OrdersLiveNotice = OrderStreamNotice | { reconnected: true };

export type OrdersLiveListener = (notice: OrdersLiveNotice) => void;

type OrdersLiveContextValue = {
  /** Estado da conexão; `closed` também sem sessão de administrador (nenhuma conexão). */
  status: EventStreamStatus;
  /** Inscreve `listener` nos avisos e devolve a função que cancela a inscrição. */
  subscribe: (listener: OrdersLiveListener) => () => void;
};

const OrdersLiveContext = createContext<OrdersLiveContextValue | null>(null);

type StatusState = {
  /** Token que produziu o estado: o de outra sessão não vale. */
  token: string;
  status: EventStreamStatus;
};

/** `data` de um evento `order`, conferido: o que não tiver `orderId` é descartado. */
function toNotice(data: unknown): OrderStreamNotice | null {
  if (typeof data !== 'object' || data === null) return null;
  const record = data as Record<string, unknown>;
  if (typeof record.orderId !== 'string' || record.orderId === '') return null;

  return {
    orderId: record.orderId,
    eventType: typeof record.eventType === 'string' ? record.eventType : '',
    messageId: typeof record.messageId === 'string' ? record.messageId : '',
    occurredAt: typeof record.occurredAt === 'string' ? record.occurredAt : '',
  };
}

/**
 * Conexão ao vivo da área administrativa: **uma** conexão por aba com `GET
 * /orders/stream` (`openEventStream`, token no cabeçalho e nunca na URL),
 * compartilhada pela lista, pelo contador do menu, pelo dashboard e pelo painel
 * do pedido, que se inscrevem com `subscribe` e filtram o que interessa.
 *
 * - Abre só com sessão de administrador e fecha ao sair da sessão, ao trocar de
 *   sessão (reabre com o novo token) e ao desmontar.
 * - A queda reabre com espera crescente (`openEventStream`); `401`/`403` encerram
 *   (`closed`).
 * - O aviso é só um sinal: cada tela relê a API REST, a fonte da verdade
 *   (`useLiveRefetch`).
 */
export function OrdersLiveProvider({ children }: { children: ReactNode }) {
  const { session, isAdmin } = useAuth();
  const token = isAdmin ? session?.token : undefined;

  const listenersRef = useRef(new Set<OrdersLiveListener>());
  const [statusState, setStatusState] = useState<StatusState | null>(null);

  useEffect(() => {
    if (!token) return;

    const emit = (notice: OrdersLiveNotice) => {
      // Cópia: um listener pode cancelar a inscrição durante o aviso.
      for (const listener of [...listenersRef.current]) listener(notice);
    };
    let reconnecting = false;

    return openEventStream({
      path: ORDERS_STREAM_PATH,
      token,
      onEvent: (event) => {
        if (event.type !== ORDER_STREAM_EVENT) return;
        const notice = toNotice(event.data);
        if (notice) emit(notice);
      },
      onStatusChange: (status) => {
        setStatusState({ token, status });
        if (status === 'reconnecting') reconnecting = true;
        if (status === 'live' && reconnecting) {
          reconnecting = false;
          emit({ reconnected: true });
        }
      },
    });
  }, [token]);

  const subscribe = useCallback((listener: OrdersLiveListener) => {
    const listeners = listenersRef.current;
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Até o primeiro estado desta sessão chegar, a conexão está sendo aberta.
  const status: EventStreamStatus = !token ? 'closed' : statusState?.token === token ? statusState.status : 'connecting';
  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);

  return <OrdersLiveContext.Provider value={value}>{children}</OrdersLiveContext.Provider>;
}

/** Estado da conexão ao vivo do admin e `subscribe`. Exige `OrdersLiveProvider` acima (layout do admin). */
export function useOrdersLive(): OrdersLiveContextValue {
  const context = useContext(OrdersLiveContext);
  if (!context) throw new Error('useOrdersLive precisa estar dentro de OrdersLiveProvider.');
  return context;
}
