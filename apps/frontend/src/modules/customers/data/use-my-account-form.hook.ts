'use client';

import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { Customer, CustomerInput } from './customer.api';
import { customerResolver, type CustomerFormData } from './customer.schema';
import {
  emptyCustomerFormValues,
  reportCustomerSaveError,
  toCustomerFormValues,
  toCustomerInput,
  type CustomerAddressDefaults,
} from './customer-form.util';

export type UseMyAccountFormOptions = {
  /** Cadastro atual; `null` quando o usuário ainda não tem cliente (criação). */
  customer: Customer | null;
  /** Endereço inicial sem cadastro (cidade e UF da loja escolhida na vitrine). */
  defaults?: CustomerAddressDefaults;
  /** Grava os dados (`save` de `useMyCustomer`), devolvendo o cadastro salvo; lança `ApiError` em falha. */
  save: (input: CustomerInput) => Promise<Customer>;
};

/**
 * Formulário de "Minha conta": CPF, telefone, endereço e o ponto do mapa, com
 * o mesmo `customerSchema` do checkout. Nasce com os dados do cliente ou, sem
 * cadastro, com `defaults` (e sem ponto). No envio chama `save` com os dados
 * sem máscara e o ponto como está no formulário (`null` remove), avisa "Dados
 * salvos" e faz `reset` com os valores salvos, para o formulário deixar de
 * estar alterado. Erros de CPF, telefone, CEP e UF vão para o campo,
 * `CUSTOMER_LOCATION_INVALID` vira o erro geral acima do mapa
 * (`errors.root.location`) e os demais viram toaster. `discard` volta aos
 * últimos valores carregados ou salvos.
 */
export function useMyAccountForm({ customer, defaults, save }: UseMyAccountFormOptions) {
  const form = useForm<CustomerFormData>({
    resolver: customerResolver,
    defaultValues: customer ? toCustomerFormValues(customer) : emptyCustomerFormValues(defaults),
  });
  const { reset, setError } = form;

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const saved = await save(toCustomerInput(data));
      reset(toCustomerFormValues(saved));
      toast.success('Dados salvos');
    } catch (error) {
      reportCustomerSaveError(error, setError, { locationError: true });
    }
  };

  return {
    form,
    hasCustomer: customer !== null,
    submit: form.handleSubmit(onSubmit),
    discard: () => reset(),
  };
}
