'use client';

import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { v } from '@/shared/components/form/validator';
import type { Customer, CustomerInput } from './customer.api';
import { customerSchema, type CustomerFormData } from './customer.schema';
import {
  emptyCustomerFormValues,
  reportCustomerSaveError,
  toCustomerFormValues,
  toCustomerInput,
  type CustomerAddressDefaults,
} from './customer-form.util';

export type UseCustomerDeliveryFormOptions = {
  /** Cadastro atual; `null` quando o usuário ainda não tem cliente (criação). */
  customer: Customer | null;
  /** Endereço inicial sem cadastro (ex.: bairro da vitrine, "Fortaleza" e "CE"). */
  defaults?: CustomerAddressDefaults;
  /** Grava os dados (`save` de `useMyCustomer`); lança `ApiError` em falha. */
  save: (input: CustomerInput) => Promise<unknown>;
  /** Chamado depois de salvar com sucesso (ex.: voltar ao resumo). */
  onSaved?: () => void;
};

/**
 * Formulário dos dados de entrega do checkout, com o mesmo `customerSchema`
 * da administração (sem `isActive`). Nasce com os dados do cliente ou, sem
 * cadastro, com `defaults`. No envio chama `save` com os dados sem máscara,
 * avisa "Dados de entrega salvos" e chama `onSaved`; erros de CPF, telefone,
 * CEP e UF vão para o campo e os demais viram toaster.
 */
export function useCustomerDeliveryForm({ customer, defaults, save, onSaved }: UseCustomerDeliveryFormOptions) {
  const form = useForm<CustomerFormData>({
    resolver: v.resolver(customerSchema),
    defaultValues: customer ? toCustomerFormValues(customer) : emptyCustomerFormValues(defaults),
  });
  const { setError } = form;

  const onSubmit = async (data: CustomerFormData) => {
    try {
      await save(toCustomerInput(data));
      toast.success('Dados de entrega salvos');
      onSaved?.();
    } catch (error) {
      reportCustomerSaveError(error, setError);
    }
  };

  return {
    form,
    hasCustomer: customer !== null,
    submit: form.handleSubmit(onSubmit),
  };
}
