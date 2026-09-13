'use client';

import type { FormEventHandler } from 'react';
import Link from 'next/link';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { FormSectionLayout } from '@/shared/components/ui/form-section-layout';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { ReadonlyTextField } from '@/shared/components/ui/readonly-text-field';
import type { CustomerFormData } from '../data/customer.schema';
import { formatCpf, formatPhone } from '../data/customer.util';
import { CustomerAddressFields } from './customer-address-fields.component';

type CustomerFormProps = {
  /** Formulário criado por `useCustomerForm` (resolver `v.resolver(customerSchema)`). */
  form: UseFormReturn<CustomerFormData>;
  /** Nome e email do usuário vinculado, somente leitura. */
  name: string;
  email: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  cancelHref: string;
};

/**
 * Edição administrativa de cliente em página (sem modal), em seções: Conta
 * (nome e email do usuário, somente leitura), Documento e contato (CPF e
 * telefone com máscara), Endereço de entrega e Situação (ativo).
 */
export function CustomerForm({ form, name, email, onSubmit, cancelHref }: CustomerFormProps) {
  const {
    control,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card className="p-5 md:p-6">
        <FormSectionLayout title="Conta" description="Usuário dono deste cadastro de cliente.">
          <div>
            <Label htmlFor="customer-account-name">Nome</Label>
            <ReadonlyTextField id="customer-account-name" value={name} />
          </div>

          <div>
            <Label htmlFor="customer-account-email">Email</Label>
            <ReadonlyTextField id="customer-account-email" value={email} />
            <p className="mt-1.5 text-xs text-muted-ink">Nome e email são da conta do usuário e não mudam aqui</p>
          </div>
        </FormSectionLayout>

        <FormSectionLayout
          title="Documento e contato"
          description="CPF do cliente e telefone de contato para a entrega."
          className="pt-10"
        >
          <div>
            <Label htmlFor="customer-cpf">CPF</Label>
            <Controller
              control={control}
              name="cpf"
              render={({ field }) => (
                <Input
                  id="customer-cpf"
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
            <Label htmlFor="customer-phone">Telefone</Label>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  id="customer-phone"
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(formatPhone(event.target.value))}
                  onBlur={field.onBlur}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
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
        </FormSectionLayout>

        <FormSectionLayout
          title="Endereço de entrega"
          description="Endereço único do cliente, substituído por inteiro ao salvar."
          className="pt-10"
        >
          <CustomerAddressFields form={form} idPrefix="customer" disabled={isSubmitting} className="gap-6" />
        </FormSectionLayout>

        <FormSectionLayout
          title="Situação"
          description="Clientes inativos continuam cadastrados e visíveis na lista."
          showDivider={false}
          className="pt-10"
        >
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="customer-is-active"
                  ref={field.ref}
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                  className="mt-px"
                />
                <Label htmlFor="customer-is-active" className="leading-[18px]">
                  Ativo
                </Label>
              </div>
            )}
          />
        </FormSectionLayout>
      </Card>

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'salvando...' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  );
}
