'use client';

import { Controller, type UseFormReturn } from 'react-hook-form';
import { Combobox } from '@/shared/components/ui/combobox';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/lib/class-name.util';
import type { CustomerFormData } from '../data/customer.schema';
import { BRAZILIAN_STATES, formatZipCode } from '../data/customer.util';

const STATE_OPTIONS = BRAZILIAN_STATES.map((state) => ({ value: state.code, label: `${state.code} · ${state.name}` }));

type CustomerAddressFieldsProps = {
  /** Formulário de cliente (`customerSchema`) do hook da tela. */
  form: UseFormReturn<CustomerFormData>;
  /** Prefixo dos ids dos campos, para os rótulos. */
  idPrefix?: string;
  disabled?: boolean;
  /** Classes da grade (ex.: espaçamento maior no admin). */
  className?: string;
};

function FieldError({ message }: { message?: string }) {
  return message ? <FormErrorMessage className="mt-1.5">{message}</FormErrorMessage> : null;
}

/**
 * Campos do endereço de entrega, compartilhados pela edição administrativa e
 * pelo checkout: CEP com máscara `00000-000`, logradouro, número, complemento,
 * bairro, cidade e UF (lista das 27 unidades federativas), cada um com o erro
 * logo abaixo.
 */
export function CustomerAddressFields({ form, idPrefix = 'customer', disabled = false, className }: CustomerAddressFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const addressErrors = errors.address;
  const fieldId = (name: string) => `${idPrefix}-${name}`;

  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-6', className)}>
      <div className="sm:col-span-2">
        <Label htmlFor={fieldId('zip-code')}>CEP</Label>
        <Controller
          control={control}
          name="address.zipCode"
          render={({ field }) => (
            <Input
              id={fieldId('zip-code')}
              ref={field.ref}
              name={field.name}
              value={field.value ?? ''}
              onChange={(event) => field.onChange(formatZipCode(event.target.value))}
              onBlur={field.onBlur}
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="00000-000"
              className="tabular-nums"
              aria-invalid={addressErrors?.zipCode ? true : undefined}
              disabled={disabled}
            />
          )}
        />
        <FieldError message={addressErrors?.zipCode?.message} />
      </div>

      <div className="sm:col-span-4">
        <Label htmlFor={fieldId('street')}>Logradouro</Label>
        <Input
          id={fieldId('street')}
          autoComplete="address-line1"
          placeholder="Ex.: Av. Santos Dumont"
          aria-invalid={addressErrors?.street ? true : undefined}
          disabled={disabled}
          {...register('address.street')}
        />
        <FieldError message={addressErrors?.street?.message} />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor={fieldId('number')}>Número</Label>
        <Input
          id={fieldId('number')}
          autoComplete="off"
          placeholder="1500 ou S/N"
          aria-invalid={addressErrors?.number ? true : undefined}
          disabled={disabled}
          {...register('address.number')}
        />
        <FieldError message={addressErrors?.number?.message} />
      </div>

      <div className="sm:col-span-4">
        <Label htmlFor={fieldId('complement')}>Complemento</Label>
        <Input
          id={fieldId('complement')}
          autoComplete="address-line2"
          placeholder="Opcional · Ex.: Torre B · 12º andar · sala 1204"
          aria-invalid={addressErrors?.complement ? true : undefined}
          disabled={disabled}
          {...register('address.complement')}
        />
        <FieldError message={addressErrors?.complement?.message} />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor={fieldId('neighborhood')}>Bairro</Label>
        <Input
          id={fieldId('neighborhood')}
          autoComplete="off"
          placeholder="Ex.: Aldeota"
          aria-invalid={addressErrors?.neighborhood ? true : undefined}
          disabled={disabled}
          {...register('address.neighborhood')}
        />
        <FieldError message={addressErrors?.neighborhood?.message} />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor={fieldId('city')}>Cidade</Label>
        <Input
          id={fieldId('city')}
          autoComplete="address-level2"
          placeholder="Ex.: Fortaleza"
          aria-invalid={addressErrors?.city ? true : undefined}
          disabled={disabled}
          {...register('address.city')}
        />
        <FieldError message={addressErrors?.city?.message} />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor={fieldId('state')}>UF</Label>
        <Controller
          control={control}
          name="address.state"
          render={({ field }) => (
            <Combobox
              id={fieldId('state')}
              ref={field.ref}
              options={STATE_OPTIONS}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder="Selecione"
              emptyText="Nenhuma UF encontrada."
              invalid={Boolean(addressErrors?.state)}
              disabled={disabled}
            />
          )}
        />
        <FieldError message={addressErrors?.state?.message} />
      </div>
    </div>
  );
}
