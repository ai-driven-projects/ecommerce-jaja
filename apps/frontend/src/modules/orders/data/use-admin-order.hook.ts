'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { getOrder, getOrderEvents, type EventTimelineEntry, type OrderAdminDetail } from './admin-order.api';
import { useLiveRefetch, type LiveLoad } from './use-live-refetch.hook';

/** Toaster único do painel: releituras que falham seguidas não empilham avisos. */
const ADMIN_ORDER_ERROR_TOAST_ID = 'admin-order-error';

const EMPTY_EVENTS: readonly EventTimelineEntry[] = [];
const EMPTY_IDS: ReadonlySet<string> = new Set();

type AdminOrderState = {
  /** Token da sessão e id do pedido que produziram o estado: outra sessão ou outro id o invalidam. */
  token: string;
  orderId: string;
  order: OrderAdminDetail | null;
  events: readonly EventTimelineEntry[];
  notFound: boolean;
  /** `false` enquanto só houve falha: a primeira leitura bem-sucedida define a base de eventos. */
  loaded: boolean;
  /** Ids dos eventos da primeira leitura bem-sucedida e dos que chegaram depois. */
  knownEventIds: ReadonlySet<string>;
  /** Eventos que chegaram depois da primeira leitura bem-sucedida (destaque). */
  newEventIds: ReadonlySet<string>;
};

/**
 * Pedido `orderId` de qualquer cliente para o painel do admin, com a linha do
 * tempo dos eventos, atualizados ao vivo.
 *
 * - `getOrder` e `getOrderEvents` em paralelo, num único estado de carregamento,
 *   chaveado pelo token e pelo id: `loading` vale `true` até a primeira resposta.
 * - Relê os dois a cada aviso do stream administrativo **deste** pedido e a cada
 *   reconexão (`useLiveRefetch` com `orderId`), com no máximo uma leitura em
 *   andamento e uma pendente. Avisos de outros pedidos não releem.
 * - `notFound` quando a API responde `404 ORDER_NOT_FOUND` (inexistente, excluído
 *   ou id malformado).
 * - `newEventIds`: eventos que chegaram depois da primeira carga (destaque breve).
 * - Erro na primeira leitura vira toaster e deixa `order` `null` com `notFound`
 *   `false`; erro numa releitura mantém o que está na tela (um toaster por vez).
 */
export function useAdminOrder(orderId: string) {
  const { session } = useAuth();
  const token = session?.token;
  const [state, setState] = useState<AdminOrderState | null>(null);

  const load = useCallback<LiveLoad>(
    async (isCurrent) => {
      if (!token) return;
      try {
        const [order, events] = await Promise.all([getOrder(token, orderId), getOrderEvents(token, orderId)]);
        if (!isCurrent()) return;

        setState((previous) => {
          const same = previous?.token === token && previous.orderId === orderId && previous.loaded ? previous : null;
          const nextEvents = events ?? [];
          const knownEventIds = new Set(same?.knownEventIds ?? []);
          const newEventIds = new Set(same?.newEventIds ?? []);

          for (const event of nextEvents) {
            if (knownEventIds.has(event.id)) continue;
            knownEventIds.add(event.id);
            if (same) newEventIds.add(event.id);
          }

          return {
            token,
            orderId,
            // O pedido pode sumir entre as duas leituras (limpeza): qualquer uma sem pedido vale "não encontrado".
            order: events === null ? null : order,
            events: nextEvents,
            notFound: order === null || events === null,
            loaded: true,
            knownEventIds,
            newEventIds,
          };
        });
      } catch (error: unknown) {
        if (!isCurrent()) return;
        toast.error(toErrorMessage(error), { id: ADMIN_ORDER_ERROR_TOAST_ID });
        setState((previous) =>
          previous?.token === token && previous.orderId === orderId
            ? previous
            : {
                token,
                orderId,
                order: null,
                events: EMPTY_EVENTS,
                notFound: false,
                loaded: false,
                knownEventIds: EMPTY_IDS,
                newEventIds: EMPTY_IDS,
              },
        );
      }
    },
    [token, orderId],
  );

  useLiveRefetch(token ? load : null, { orderId });

  const current = token && state?.token === token && state.orderId === orderId ? state : null;

  return {
    order: current?.order ?? null,
    events: current?.events ?? EMPTY_EVENTS,
    loading: Boolean(token) && current === null,
    notFound: current?.notFound ?? false,
    newEventIds: current?.newEventIds ?? EMPTY_IDS,
  };
}
