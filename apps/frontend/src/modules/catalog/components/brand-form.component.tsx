'use client';

import { useState, type ChangeEvent, type FormEventHandler } from 'react';
import Link from 'next/link';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { Alias, Url } from '@mentoria-360/shared';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { FormSectionLayout } from '@/shared/components/ui/form-section-layout';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { BRAND_DESCRIPTION_MAX_LENGTH, type BrandFormData } from '../data/brand.schema';
import { BrandLogo } from './brand-logo.component';

type BrandFormProps = {
  /** Formulário criado por `useBrandForm` (resolver `v.resolver(brandSchema)`). */
  form: UseFormReturn<BrandFormData>;
  isEditing: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  cancelHref: string;
};

/**
 * Formulário de marca em página (sem modal). Na criação, o slug acompanha o
 * nome (`Alias.format`) até o administrador editá-lo; na edição já nasce
 * editado, para mudar o nome não reescrever URLs. O logo tem pré-visualização
 * quando a URL é válida e o status ativo só aparece na edição.
 */
export function BrandForm({ form, isEditing, onSubmit, cancelHref }: BrandFormProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = form;

  const [slugTouched, setSlugTouched] = useState(isEditing);
  const name = useWatch({ control, name: 'name' });
  const logoUrl = useWatch({ control, name: 'logoUrl' })?.trim() ?? '';
  const descriptionLength = useWatch({ control, name: 'description' })?.length ?? 0;
  const hasLogoPreview = Url.isValid(logoUrl);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card className="p-5 md:p-6">
        <FormSectionLayout
          title="Identificação"
          description="Nome exibido no catálogo e slug usado nos endereços da marca."
        >
          <div>
            <Label htmlFor="brand-name">Nome</Label>
            <Input
              id="brand-name"
              autoComplete="off"
              placeholder="Ex.: Café & Cia"
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
            <Label htmlFor="brand-slug">Slug</Label>
            <Input
              id="brand-slug"
              autoComplete="off"
              placeholder={Alias.format(name ?? '') || 'cafe-cia'}
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
        </FormSectionLayout>

        <FormSectionLayout
          title="Apresentação"
          description="Descrição curta e logotipo mostrados junto da marca."
          showDivider={isEditing}
          className="pt-10"
        >
          <div>
            <Label htmlFor="brand-description">Descrição</Label>
            <Textarea
              id="brand-description"
              placeholder="Opcional"
              aria-invalid={errors.description ? true : undefined}
              disabled={isSubmitting}
              {...register('description')}
            />
            <div className="mt-1.5 flex items-start justify-between gap-3">
              {errors.description?.message ? (
                <FormErrorMessage>{errors.description.message}</FormErrorMessage>
              ) : (
                <span />
              )}
              <span
                className={
                  descriptionLength > BRAND_DESCRIPTION_MAX_LENGTH
                    ? 'text-xs font-semibold tabular-nums text-danger'
                    : 'text-xs tabular-nums text-muted-ink'
                }
              >
                {descriptionLength}/{BRAND_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="brand-logo-url">URL do logotipo</Label>
            <Input
              id="brand-logo-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://exemplo.com/logo.png"
              aria-invalid={errors.logoUrl ? true : undefined}
              disabled={isSubmitting}
              {...register('logoUrl')}
            />
            {errors.logoUrl?.message ? (
              <FormErrorMessage className="mt-1.5">{errors.logoUrl.message}</FormErrorMessage>
            ) : null}
            {hasLogoPreview ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface p-3">
                <BrandLogo key={logoUrl} url={logoUrl} name={name || 'nova marca'} size="lg" />
                <p className="text-xs text-muted-ink">Pré-visualização do logotipo.</p>
              </div>
            ) : null}
          </div>
        </FormSectionLayout>

        {isEditing ? (
          <FormSectionLayout
            title="Status"
            description="Marcas inativas continuam cadastradas, mas ficam fora do uso no catálogo."
            showDivider={false}
            className="pt-10"
          >
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="brand-is-active"
                    ref={field.ref}
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    disabled={isSubmitting}
                    className="mt-px"
                  />
                  <Label htmlFor="brand-is-active" className="leading-[18px]">
                    Marca ativa
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
          {isSubmitting ? 'salvando...' : isEditing ? 'Salvar alterações' : 'Criar marca'}
        </Button>
      </div>
    </form>
  );
}
