'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { v } from '@/shared/components/form/validator';
import { customersRoute } from '@/shared/navigation/customers-routes';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { getCustomer, updateCustomer } from './customer.api';
import { customerSchema, type CustomerFormData } from './customer.schema';
import {
  emptyCustomerFormValues,
  reportCustomerSaveError,
  toCustomerFormValues,
  toCustomerInput,
} from './customer-form.util';

/** Conta do usuário vinculado ao cliente carregado, exibida somente leitura. */
type LoadedAccount = {
  id: string;
  name: string;
  email: string;
};

export type UseCustomerFormOptions = {
  /** Cliente a editar (não existe criação pela administração). */
  id: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto, usada no retorno. */
  returnQuery?: string;
};

/**
 * Estado do formulário administrativo de cliente, só de edição. Carrega o
 * cliente por id (falha, como `404 CUSTOMER_NOT_FOUND` em `/admin/customers/new`,
 * vira toaster e volta para a lista) e expõe `name`/`email` do usuário para
 * exibição. No envio, manda os dados sem máscara (complemento vazio como
 * `null`) com `isActive`; erros de CPF, telefone, CEP e UF vão para o campo e
 * os demais viram toaster. Sucesso avisa "Cliente atualizado" e volta para a
 * lista na mesma página, busca e status de origem (`listHref`), que busca de novo.
 */
export function useCustomerForm({ id, returnQuery = '' }: UseCustomerFormOptions) {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const listHref = customersRoute(returnQuery);

  const form = useForm<CustomerFormData>({
    resolver: v.resolver(customerSchema),
    defaultValues: { ...emptyCustomerFormValues(), isActive: true },
  });
  const { reset, setError } = form;

  const [account, setAccount] = useState<LoadedAccount | null>(null);
  const loading = account?.id !== id;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    getCustomer(token, id)
      .then((customer) => {
        if (cancelled) return;
        reset({ ...toCustomerFormValues(customer), isActive: customer.isActive });
        setAccount({ id, name: customer.name, email: customer.email });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        router.replace(listHref);
      });

    return () => {
      cancelled = true;
    };
  }, [id, token, reset, router, listHref]);

  const onSubmit = async (data: CustomerFormData) => {
    if (!token) return;

    try {
      await updateCustomer(token, id, toCustomerInput(data));
      toast.success('Cliente atualizado');
      router.push(listHref);
    } catch (error) {
      reportCustomerSaveError(error, setError);
    }
  };

  return {
    form,
    loading,
    name: account?.name ?? '',
    email: account?.email ?? '',
    listHref,
    submit: form.handleSubmit(onSubmit),
  };
}
