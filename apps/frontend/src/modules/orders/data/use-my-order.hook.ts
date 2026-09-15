'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { getMyOrder, type OrderDetail } from './order.api';

type MyOrderState = {
  /** Token da sessão e id do pedido que produziram o estado: outra sessão ou outro id o invalidam. */
  token: string;
  orderId: string;
  order: OrderDetail | null;
  notFound: boolean;
};

/**
 * Pedido `orderId` do usuário da sessão, para o acompanhamento. O estado é
 * chaveado pelo token e pelo id: sem sessão `order` é `null` sem chamar a API,
 * e entrar com outra conta consulta de novo. `loading` vale `true` enquanto o
 * pedido da sessão atual não foi consultado; `notFound` quando a API responde
 * `404 ORDER_NOT_FOUND` (inclusive pedido de outro usuário). Outros erros viram
 * toaster e deixam `order` `null` com `notFound` `false`.
 */
export function useMyOrder(orderId: string) {
  const { session } = useAuth();
  const token = session?.token;

  const [state, setState] = useState<MyOrderState | null>(null);
  const current = token && state?.token === token && state.orderId === orderId ? state : null;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    getMyOrder(token, orderId)
      .then((order) => {
        if (!cancelled) setState({ token, orderId, order, notFound: order === null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        setState({ token, orderId, order: null, notFound: false });
      });

    return () => {
      cancelled = true;
    };
  }, [token, orderId]);

  return {
    order: current?.order ?? null,
    loading: Boolean(token) && current === null,
    notFound: current?.notFound ?? false,
  };
}
