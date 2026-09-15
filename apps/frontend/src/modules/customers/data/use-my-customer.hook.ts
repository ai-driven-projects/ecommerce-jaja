'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { getMessage } from '@/shared/i18n';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { getMyCustomer, saveMyCustomer, type CustomerDetail, type CustomerInput } from './customer.api';

type MyCustomerState = {
  /** Token da sessão que produziu `customer`: outra sessão invalida o estado. */
  token: string;
  customer: CustomerDetail | null;
};

/**
 * Cadastro de cliente do usuário da sessão, para a loja. O estado é chaveado
 * pelo token: sem sessão (inclusive depois de "sair") `customer` é `null` sem
 * chamar a API, e entrar com outra conta carrega o cadastro dela. `loading`
 * vale `true` enquanto o cadastro da sessão atual não foi consultado; erro de
 * carregamento vira toaster (e o passo segue sem cadastro). `save` cria ou
 * altera o cadastro (`PUT /me/customer`) e atualiza `customer`, com nome e
 * email da sessão; em falha, lança o erro para o formulário tratar. `refresh`
 * consulta de novo o cadastro da sessão atual (ex.: depois de a API recusar o
 * pedido por causa do cadastro), mantendo o valor exibido até a resposta.
 */
export function useMyCustomer() {
  const { session } = useAuth();
  const token = session?.token;
  const user = session?.user;

  const [state, setState] = useState<MyCustomerState | null>(null);
  // Cada incremento pede uma nova consulta do cadastro da sessão atual.
  const [reloadCount, setReloadCount] = useState(0);
  const current = token && state?.token === token ? state : null;
  const customer = current?.customer ?? null;
  const loading = Boolean(token) && current === null;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    getMyCustomer(token)
      .then((next) => {
        if (!cancelled) setState({ token, customer: next });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        setState({ token, customer: null });
      });

    return () => {
      cancelled = true;
    };
  }, [token, reloadCount]);

  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

  const save = useCallback(
    async (input: CustomerInput): Promise<CustomerDetail> => {
      if (!token || !user) throw new Error(getMessage('USER_UNAUTHORIZED'));

      const saved = await saveMyCustomer(token, input);
      const detail: CustomerDetail = { ...saved, name: user.name, email: user.email };
      setState({ token, customer: detail });
      return detail;
    },
    [token, user],
  );

  return {
    customer,
    loading,
    hasCustomer: customer !== null,
    save,
    refresh,
  };
}
