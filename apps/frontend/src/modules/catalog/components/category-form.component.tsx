'use client';

import { useState, type ChangeEvent, type FormEventHandler } from 'react';
import Link from 'next/link';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { Alias, Url } from '@mentoria-360/shared';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Combobox } from '@/shared/components/ui/combobox';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { FormSectionLayout } from '@/shared/components/ui/form-section-layout';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { CATEGORY_DESCRIPTION_MAX_LENGTH, type CategoryFormData } from '../data/category.schema';
import type { CategoryParentOption } from '../data/use-category-form.hook';

type CategoryFormProps = {
  /** Formulário criado por `useCategoryForm` (resolver `v.resolver(categorySchema)`). */
  form: UseFormReturn<CategoryFormData>;
  isEditing: boolean;
  /** "Sem categoria pai (raiz)" seguida das categorias de nível 1 e 2, rotuladas pelo `path`. */
  parentOptions: CategoryParentOption[];
  onSubmit: FormEventHandler<HTMLFormElement>;
  cancelHref: string;
};

/** Pré-visualização da imagem; some quando a URL não carrega. */
function CategoryImagePreview({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-surface p-3">
      {failed ? (
        <span aria-hidden="true" className="block size-24 shrink-0 rounded-[14px] border border-line bg-card" />
      ) : (
        <span className="flex size-24 shrink-0 items-center justify-center rounded-[14px] border border-line bg-card p-2">
          {/* Imagens vêm de URLs externas arbitrárias informadas no cadastro, fora do otimizador de imagens. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`Imagem da categoria ${name}`}
            className="size-full object-contain"
            onError={() => setFailed(true)}
          />
        </span>
      )}
      <p className="text-xs text-muted-ink">
        {failed ? 'Não foi possível carregar a imagem desta URL.' : 'Pré-visualização da imagem.'}
      </p>
    </div>
  );
}

/**
 * Formulário de categoria em página (sem modal). O pai é escolhido num
 * `Combobox` rotulado pelo caminho. Na criação, o slug acompanha o nome
 * (`Alias.format`) até o administrador editá-lo; na edição já nasce editado,
 * para mudar o nome não reescrever URLs. A imagem tem pré-visualização quando
 * a URL é válida e o status ativo só aparece na edição.
 */
export function CategoryForm({ form, isEditing, parentOptions, onSubmit, cancelHref }: CategoryFormProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = form;

  const [slugTouched, setSlugTouched] = useState(isEditing);
  const name = useWatch({ control, name: 'name' });
  const imageUrl = useWatch({ control, name: 'imageUrl' })?.trim() ?? '';
  const descriptionLength = useWatch({ control, name: 'description' })?.length ?? 0;
  const hasImagePreview = Url.isValid(imageUrl);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card className="p-5 md:p-6">
        <FormSectionLayout
          title="Posição na árvore"
          description="Departamentos ficam na raiz; grupos e subgrupos ficam dentro de uma categoria de nível 1 ou 2."
        >
          <div>
            <Label htmlFor="category-parent">Categoria pai</Label>
            <Controller
              control={control}
              name="parentId"
              render={({ field }) => (
                <Combobox
                  id="category-parent"
                  ref={field.ref}
                  options={parentOptions}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Selecione a categoria pai"
                  emptyText="Nenhuma categoria encontrada."
                  invalid={Boolean(errors.parentId)}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.parentId?.message ? (
              <FormErrorMessage className="mt-1.5">{errors.parentId.message}</FormErrorMessage>
            ) : (
              <p className="mt-1.5 text-xs text-muted-ink">A hierarquia tem no máximo 3 níveis.</p>
            )}
          </div>

          <div>
            <Label htmlFor="category-order">Ordem</Label>
            <Input
              id="category-order"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              className="max-w-40"
              aria-invalid={errors.order ? true : undefined}
              disabled={isSubmitting}
              {...register('order', { valueAsNumber: true })}
            />
            {errors.order?.message ? (
              <FormErrorMessage className="mt-1.5">{errors.order.message}</FormErrorMessage>
            ) : (
              <p className="mt-1.5 text-xs text-muted-ink">Posição entre as irmãs; menor aparece primeiro.</p>
            )}
          </div>
        </FormSectionLayout>

        <FormSectionLayout
          title="Identificação"
          description="Nome exibido no catálogo e slug usado nos endereços da categoria."
          className="pt-10"
        >
          <div>
            <Label htmlFor="category-name">Nome</Label>
            <Input
              id="category-name"
              autoComplete="off"
              placeholder="Ex.: Borrachas Técnicas"
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
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              autoComplete="off"
              placeholder={Alias.format(name ?? '') || 'borrachas-tecnicas'}
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
          description="Descrição, destaque e imagem mostrados junto da categoria."
          showDivider={isEditing}
          className="pt-10"
        >
          <div>
            <Label htmlFor="category-description">Descrição</Label>
            <Textarea
              id="category-description"
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
                  descriptionLength > CATEGORY_DESCRIPTION_MAX_LENGTH
                    ? 'text-xs font-semibold tabular-nums text-danger'
                    : 'text-xs tabular-nums text-muted-ink'
                }
              >
                {descriptionLength}/{CATEGORY_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          <Controller
            control={control}
            name="isHighlighted"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="category-is-highlighted"
                  ref={field.ref}
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                  className="mt-px"
                />
                <div>
                  <Label htmlFor="category-is-highlighted" className="leading-[18px]">
                    Categoria em destaque
                  </Label>
                  <p className="mt-1 text-xs text-muted-ink">Recebe o selo &quot;Destaque&quot; na árvore.</p>
                </div>
              </div>
            )}
          />

          <div>
            <Label htmlFor="category-image-url">URL da imagem</Label>
            <Input
              id="category-image-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://exemplo.com/categoria.png"
              aria-invalid={errors.imageUrl ? true : undefined}
              disabled={isSubmitting}
              {...register('imageUrl')}
            />
            {errors.imageUrl?.message ? (
              <FormErrorMessage className="mt-1.5">{errors.imageUrl.message}</FormErrorMessage>
            ) : null}
            {hasImagePreview ? (
              <CategoryImagePreview key={imageUrl} url={imageUrl} name={name || 'nova categoria'} />
            ) : null}
          </div>
        </FormSectionLayout>

        {isEditing ? (
          <FormSectionLayout
            title="Status"
            description="Categorias inativas continuam cadastradas, mas ficam fora do uso no catálogo."
            showDivider={false}
            className="pt-10"
          >
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="category-is-active"
                    ref={field.ref}
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    disabled={isSubmitting}
                    className="mt-px"
                  />
                  <Label htmlFor="category-is-active" className="leading-[18px]">
                    Categoria ativa
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
          {isSubmitting ? 'salvando...' : isEditing ? 'Salvar alterações' : 'Criar categoria'}
        </Button>
      </div>
    </form>
  );
}
