'use client';

import { Controller } from 'react-hook-form';
import { Button } from '@/shared/components/ui/button';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { formatCpf, formatPhone } from '../data/customer.util';
import {
  useCustomerDeliveryForm,
  type UseCustomerDeliveryFormOptions,
} from '../data/use-customer-delivery-form.hook';
import { CustomerAddressFields } from './customer-address-fields.component';

type CustomerDeliveryFormProps = UseCustomerDeliveryFormOptions & {
  /** Volta ao resumo sem salvar; o botão "Cancelar" só aparece quando já existe cadastro. */
  onCancel?: () => void;
};

/**
 * Dados de entrega do checkout, no visual da loja: CPF e telefone (com
 * máscara, lado a lado em telas largas), o endereço e "Salvar dados de
 * entrega". Com cadastro existente (alteração) mostra também "Cancelar".
 * Montar de novo a cada abertura reinicia os valores.
 */
export function CustomerDeliveryForm({ onCancel, ...options }: CustomerDeliveryFormProps) {
  const { form, hasCustomer, submit } = useCustomerDeliveryForm(options);
  const {
    control,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="delivery-cpf">CPF</Label>
          <Controller
            control={control}
            name="cpf"
            render={({ field }) => (
              <Input
                id="delivery-cpf"
                ref={field.ref}
                name={field.name}
                value={field.value ?? ''}
                onChange={(event) => field.onChange(formatCpf(event.target.value))}
                onBlur={field.onBlur}
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                className="tabular-nums"
                aria-invalid={errors.cpf ? true : undefined}
                disabled={isSubmitting}
              />
            )}
          />
          {errors.cpf?.message ? <FormErrorMessage className="mt-1.5">{errors.cpf.message}</FormErrorMessage> : null}
        </div>

        <div>
          <Label htmlFor="delivery-phone">Telefone</Label>
          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                id="delivery-phone"
                ref={field.ref}
                name={field.name}
                value={field.value ?? ''}
                onChange={(event) => field.onChange(formatPhone(event.target.value))}
                onBlur={field.onBlur}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="(85) 99999-9999"
                className="tabular-nums"
                aria-invalid={errors.phone ? true : undefined}
                disabled={isSubmitting}
              />
            )}
          />
          {errors.phone?.message ? (
            <FormErrorMessage className="mt-1.5">{errors.phone.message}</FormErrorMessage>
          ) : null}
        </div>
      </div>

      <CustomerAddressFields form={form} idPrefix="delivery" disabled={isSubmitting} />

      <div className="mt-1 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        {hasCustomer && onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        ) : null}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Salvando…' : 'Salvar dados de entrega'}
        </Button>
      </div>
    </form>
  );
}
