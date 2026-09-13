'use client';

import { useState, type ChangeEvent, type FormEventHandler } from 'react';
import Link from 'next/link';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { Alias } from '@mentoria-360/shared';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { FormSectionLayout } from '@/shared/components/ui/form-section-layout';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { formatPhone } from '@/shared/util/phone.util';
import { STORE_ADDRESS_MAX_LENGTH, type StoreFormData } from '../data/store.schema';
import { StoreLocationField } from './store-location-field.component';

/** Texto de apoio da seção de localização (spec `stores/store-admin`). */
export const STORE_LOCATION_SECTION_DESCRIPTION =
  'Ponto da loja e raio de entrega em linha reta. Nesta versão o raio é informativo e não restringe pedidos.';

type StoreFormProps = {
  /** Formulário criado por `useStoreForm` (resolver `v.resolver(storeSchema)`). */
  form: UseFormReturn<StoreFormData>;
  /** Token da sessão, usado pela busca de endereço no mapa. */
  token?: string;
  isEditing: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  cancelHref: string;
};

/**
 * Formulário de loja em página (sem modal). Na criação, o slug acompanha o
 * nome (`Alias.format`) até o administrador editá-lo; na edição já nasce
 * editado. A seção de localização traz o endereço de referência e o campo de
 * localização (Google Maps ou mapa simulado); o status "Ativa" só aparece na edição.
 */
export function StoreForm({ form, token, isEditing, onSubmit, cancelHref }: StoreFormProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = form;

  const [slugTouched, setSlugTouched] = useState(isEditing);
  const name = useWatch({ control, name: 'name' });
  const addressLength = useWatch({ control, name: 'address' })?.length ?? 0;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card className="p-5 md:p-6">
        <FormSectionLayout
          title="Identificação"
          description="Nome e slug que identificam a loja no cadastro e o telefone de contato da loja."
        >
          <div>
            <Label htmlFor="store-name">Nome</Label>
            <Input
              id="store-name"
              autoComplete="off"
              placeholder="Ex.: Loja Aldeota"
              aria-invalid={errors.name ? true : undefined}
              disabled={isSubmitting}
              {...register('name', {
                onChange: (event: ChangeEvent<HTMLInputElement>) => {
                  if (slugTouched) return;
                  setValue('slug', Alias.format(event.target.value), { shouldValidate: isSubmitted });
                },
              })}
            />
            {errors.name?.message ? <FormErrorMessage className="mt-1.5">{errors.name.message}</FormErrorMessage> : null}
          </div>

          <div>
            <Label htmlFor="store-slug">Slug</Label>
            <Input
              id="store-slug"
              autoComplete="off"
              placeholder={Alias.format(name ?? '') || 'loja-aldeota'}
              aria-invalid={errors.slug ? true : undefined}
              disabled={isSubmitting}
              {...register('slug', { onChange: () => setSlugTouched(true) })}
            />
            {errors.slug?.message ? (
              <FormErrorMessage className="mt-1.5">{errors.slug.message}</FormErrorMessage>
            ) : (
              <p className="mt-1.5 text-xs text-muted-ink">
                {slugTouched
                  ? 'Letras minúsculas, números e hífens.'
                  : 'Preenchido a partir do nome enquanto você não editar.'}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="store-phone">Telefone</Label>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  id="store-phone"
                  ref={field.ref}
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(formatPhone(event.target.value))}
                  onBlur={field.onBlur}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="(85) 3000-1001"
                  className="tabular-nums"
                  aria-invalid={errors.phone ? true : undefined}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.phone?.message ? (
              <FormErrorMessage className="mt-1.5">{errors.phone.message}</FormErrorMessage>
            ) : (
              <p className="mt-1.5 text-xs text-muted-ink">Opcional. Com DDD.</p>
            )}
          </div>
        </FormSectionLayout>

        <FormSectionLayout
          title="Localização e atendimento"
          description={STORE_LOCATION_SECTION_DESCRIPTION}
          showDivider={isEditing}
          className="pt-10"
        >
          <div>
            <Label htmlFor="store-address">Endereço de referência</Label>
            <Input
              id="store-address"
              autoComplete="off"
              placeholder="Ex.: Rua Silva Paulet, 1100 – Aldeota, Fortaleza/CE"
              aria-invalid={errors.address ? true : undefined}
              disabled={isSubmitting}
              {...register('address')}
            />
            <div className="mt-1.5 flex items-start justify-between gap-3">
              {errors.address?.message ? (
                <FormErrorMessage>{errors.address.message}</FormErrorMessage>
              ) : (
                <span className="text-xs text-muted-ink">Opcional. Usado para localizar o ponto e na lista.</span>
              )}
              <span
                className={
                  addressLength > STORE_ADDRESS_MAX_LENGTH
                    ? 'text-xs font-semibold tabular-nums text-danger'
                    : 'text-xs tabular-nums text-muted-ink'
                }
              >
                {addressLength}/{STORE_ADDRESS_MAX_LENGTH}
              </span>
            </div>
          </div>

          <StoreLocationField form={form} token={token} isEditing={isEditing} disabled={isSubmitting} />
        </FormSectionLayout>

        {isEditing ? (
          <FormSectionLayout
            title="Publicação"
            description="Lojas inativas continuam cadastradas, mas ficam fora da operação."
            showDivider={false}
            className="pt-10"
          >
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="store-is-active"
                    ref={field.ref}
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    disabled={isSubmitting}
                    className="mt-px"
                  />
                  <Label htmlFor="store-is-active" className="leading-[18px]">
                    Ativa
                  </Label>
                </div>
              )}
            />
          </FormSectionLayout>
        ) : null}
      </Card>

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'salvando...' : isEditing ? 'Salvar alterações' : 'Criar loja'}
        </Button>
      </div>
    </form>
  );
}
