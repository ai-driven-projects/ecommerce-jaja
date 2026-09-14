'use client';

import { useState, type ChangeEvent, type FormEventHandler, type Ref } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { Alias, Url } from '@mentoria-360/shared';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Combobox } from '@/shared/components/ui/combobox';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { FormSectionLayout } from '@/shared/components/ui/form-section-layout';
import { Input, type InputProps } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { OrderableObjectList } from '@/shared/components/ui/orderable-object-list';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/class-name.util';
import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_MAX_IMAGES,
  type ProductFormData,
  type ProductImageFormData,
} from '../data/product.schema';
import type { BrandSelectState } from '../data/use-brand-options.hook';
import type { CategorySelectState } from '../data/use-category-options.hook';
import { ProductThumbnail } from './product-thumbnail.component';

type ProductFormProps = {
  /** Formulário criado por `useProductForm` (resolver `v.resolver(productSchema)`). */
  form: UseFormReturn<ProductFormData>;
  isEditing: boolean;
  /** Seletor de marca com busca na API: "Sem marca" (quando não há busca) seguida das marcas carregadas. */
  brandSelect: BrandSelectState;
  /** Seletor de categoria com busca na API, rotulado pelo caminho completo. */
  categorySelect: CategorySelectState;
  onSubmit: FormEventHandler<HTMLFormElement>;
  cancelHref: string;
};

/** Reais com vírgula e duas casas (`3.9` → `"3,90"`); vazio sem valor. */
function formatReais(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '';
  return value.toFixed(2).replace('.', ',');
}

/**
 * Texto digitado → reais. Aceita `12,90`, `1.290,90` e `12.90`; vazio vira
 * `undefined` e texto que não é número vira `NaN` (o schema acusa inválido).
 */
function parseReais(text: string): number | undefined {
  const normalized = text.replace(/\s/g, '').replace(/^R\$/i, '');
  if (normalized === '') return undefined;

  const decimal = normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized;
  return /^\d+(\.\d+)?$/.test(decimal) ? Number(decimal) : Number.NaN;
}

type PriceInputProps = Omit<InputProps, 'value' | 'defaultValue' | 'onChange' | 'type'> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  ref?: Ref<HTMLInputElement>;
};

/** Campo de preço em reais com prefixo "R$"; guarda o texto digitado e entrega o número ao formulário. */
function PriceInput({ value, onChange, onBlur, ref, className, ...props }: PriceInputProps) {
  const [text, setText] = useState(() => formatReais(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // Valor trocado por fora (reset do formulário): reescreve o texto sem atrapalhar a digitação.
  if (!Object.is(value, syncedValue)) {
    setSyncedValue(value);
    if (!Object.is(parseReais(text), value)) setText(formatReais(value));
  }

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-bold text-muted-ink"
      >
        R$
      </span>
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={text}
        className={cn('pl-10 tabular-nums', className)}
        onChange={(event) => {
          setText(event.target.value);
          onChange(parseReais(event.target.value));
        }}
        onBlur={(event) => {
          const parsed = parseReais(text);
          if (parsed !== undefined && Number.isFinite(parsed)) setText(formatReais(parsed));
          onBlur?.(event);
        }}
      />
    </div>
  );
}

/** Mensagem de erro do campo ou, sem erro, a dica em cinza. */
function FieldFeedback({ error, hint }: { error?: string; hint?: string }) {
  if (error) return <FormErrorMessage className="mt-1.5">{error}</FormErrorMessage>;
  return hint ? <p className="mt-1.5 text-xs text-muted-ink">{hint}</p> : null;
}

const EMPTY_IMAGE: ProductImageFormData = { thumbUrl: '', largeUrl: '' };

/**
 * Formulário de produto em página (sem modal), em seções: Identificação (o
 * slug acompanha o nome via `Alias.format` até ser editado; na edição já nasce
 * editado), Classificação (marca com "Sem marca" e categoria pelo caminho),
 * Descrição, Preço (reais com duas casas e unidade), Imagens (lista ordenável
 * com pré-visualização, a primeira é a principal, no máximo 10) e Publicação
 * ("Destaque na vitrine" sempre; ativo/inativo só na edição). Erro geral da API
 * aparece acima dos botões.
 */
export function ProductForm({
  form,
  isEditing,
  brandSelect,
  categorySelect,
  onSubmit,
  cancelHref,
}: ProductFormProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors, isSubmitting, isSubmitted },
  } = form;

  const [slugTouched, setSlugTouched] = useState(isEditing);
  const name = useWatch({ control, name: 'name' });
  const descriptionLength = useWatch({ control, name: 'description' })?.length ?? 0;
  const rootError = errors.root?.server?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card className="p-5 md:p-6">
        <FormSectionLayout
          title="Identificação"
          description="Nome exibido no catálogo, slug usado no endereço do produto e código interno (SKU)."
        >
          <div>
            <Label htmlFor="product-name">Nome</Label>
            <Input
              id="product-name"
              autoComplete="off"
              placeholder="Ex.: Caderno Universitário 10 Matérias"
              aria-invalid={errors.name ? true : undefined}
              disabled={isSubmitting}
              {...register('name', {
                onChange: (event: ChangeEvent<HTMLInputElement>) => {
                  if (slugTouched) return;
                  setValue('slug', Alias.format(event.target.value), { shouldValidate: isSubmitted });
                },
              })}
            />
            <FieldFeedback error={errors.name?.message} />
          </div>

          <div>
            <Label htmlFor="product-slug">Slug</Label>
            <Input
              id="product-slug"
              autoComplete="off"
              placeholder={Alias.format(name ?? '') || 'caderno-universitario-10-materias'}
              aria-invalid={errors.slug ? true : undefined}
              disabled={isSubmitting}
              {...register('slug', { onChange: () => setSlugTouched(true) })}
            />
            <FieldFeedback
              error={errors.slug?.message}
              hint={
                slugTouched
                  ? 'Letras minúsculas, números e hífens.'
                  : 'Preenchido a partir do nome enquanto você não editar.'
              }
            />
          </div>

          <div>
            <Label htmlFor="product-sku">SKU</Label>
            <Input
              id="product-sku"
              autoComplete="off"
              placeholder="Opcional"
              className="max-w-60"
              aria-invalid={errors.sku ? true : undefined}
              disabled={isSubmitting}
              {...register('sku')}
            />
            <FieldFeedback error={errors.sku?.message} hint="Código único do produto, até 40 caracteres." />
          </div>
        </FormSectionLayout>

        <FormSectionLayout
          title="Classificação"
          description="Marca do fabricante (opcional) e a categoria em que o produto aparece."
          className="pt-10"
        >
          <div>
            <Label htmlFor="product-brand">Marca</Label>
            <Controller
              control={control}
              name="brandId"
              render={({ field }) => (
                <Combobox
                  id="product-brand"
                  ref={field.ref}
                  options={brandSelect.options}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Sem marca"
                  emptyText="Nenhuma marca encontrada."
                  invalid={Boolean(errors.brandId)}
                  disabled={isSubmitting}
                  onSearchChange={brandSelect.setSearch}
                  selectedOption={brandSelect.selectedOption}
                  loading={brandSelect.loading}
                  hasMore={brandSelect.hasMore}
                  onLoadMore={brandSelect.loadMore}
                />
              )}
            />
            <FieldFeedback error={errors.brandId?.message} />
          </div>

          <div>
            <Label htmlFor="product-category">Categoria</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Combobox
                  id="product-category"
                  ref={field.ref}
                  options={categorySelect.options}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Selecione a categoria"
                  emptyText="Nenhuma categoria encontrada."
                  invalid={Boolean(errors.categoryId)}
                  disabled={isSubmitting}
                  onSearchChange={categorySelect.setSearch}
                  selectedOption={categorySelect.selectedOption}
                  loading={categorySelect.loading}
                  hasMore={categorySelect.hasMore}
                  onLoadMore={categorySelect.loadMore}
                />
              )}
            />
            <FieldFeedback
              error={errors.categoryId?.message}
              hint="O produto também aparece nos filtros das categorias acima dela."
            />
          </div>
        </FormSectionLayout>

        <FormSectionLayout title="Descrição" description="Texto exibido em “Sobre o produto”." className="pt-10">
          <div>
            <Label htmlFor="product-description">Descrição</Label>
            <Textarea
              id="product-description"
              rows={6}
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
                  descriptionLength > PRODUCT_DESCRIPTION_MAX_LENGTH
                    ? 'text-xs font-semibold tabular-nums text-danger'
                    : 'text-xs tabular-nums text-muted-ink'
                }
              >
                {descriptionLength}/{PRODUCT_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>
        </FormSectionLayout>

        <FormSectionLayout
          title="Preço"
          description={'Valores em reais. O preço "De:" é opcional e aparece riscado ao lado do preço.'}
          className="pt-10"
        >
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <Label htmlFor="product-price">Preço</Label>
              <Controller
                control={control}
                name="price"
                render={({ field }) => (
                  <PriceInput
                    id="product-price"
                    ref={field.ref}
                    placeholder="0,00"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={errors.price ? true : undefined}
                    disabled={isSubmitting}
                  />
                )}
              />
              <FieldFeedback error={errors.price?.message} hint="Ex.: 12,90" />
            </div>

            <div>
              <Label htmlFor="product-list-price">Preço &quot;De:&quot;</Label>
              <Controller
                control={control}
                name="listPrice"
                render={({ field }) => (
                  <PriceInput
                    id="product-list-price"
                    ref={field.ref}
                    placeholder="Opcional"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    aria-invalid={errors.listPrice ? true : undefined}
                    disabled={isSubmitting}
                  />
                )}
              />
              <FieldFeedback error={errors.listPrice?.message} hint="Precisa ser maior que o preço." />
            </div>
          </div>

          <div>
            <Label htmlFor="product-unit">Unidade</Label>
            <Input
              id="product-unit"
              autoComplete="off"
              placeholder="unidade"
              className="max-w-60"
              aria-invalid={errors.unit ? true : undefined}
              disabled={isSubmitting}
              {...register('unit')}
            />
            <FieldFeedback error={errors.unit?.message} hint="Ex.: unidade, caixa com 12, pacote com 100." />
          </div>
        </FormSectionLayout>

        <FormSectionLayout
          title="Imagens"
          description={`Até ${PRODUCT_MAX_IMAGES} imagens. A primeira da lista é a principal; use as setas para reordenar.`}
          className="pt-10"
        >
          <Controller
            control={control}
            name="images"
            render={({ field }) => {
              const images = field.value ?? [];
              const limitReached = images.length >= PRODUCT_MAX_IMAGES;

              const updateImage = (index: number, key: keyof ProductImageFormData, value: string) => {
                field.onChange(images.map((image, current) => (current === index ? { ...image, [key]: value } : image)));
              };

              return (
                <div className="flex flex-col gap-3">
                  <OrderableObjectList
                    items={images}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    labels={{
                      moveUp: 'Mover imagem para cima',
                      moveDown: 'Mover imagem para baixo',
                      remove: 'Remover imagem',
                    }}
                    emptyState="Nenhuma imagem adicionada. Sem imagens, o produto aparece com o placeholder."
                    getItemTitle={({ index }) => (
                      <span className="flex items-center gap-2 font-bold text-ink">
                        Imagem {index + 1}
                        {index === 0 ? (
                          <Badge variant="brand" className="px-2 py-0.5">
                            Principal
                          </Badge>
                        ) : null}
                      </span>
                    )}
                    renderItem={({ item, index }) => {
                      const thumbUrl = item.thumbUrl.trim();
                      const itemErrors = errors.images?.[index];

                      return (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[96px_minmax(0,1fr)]">
                          <ProductThumbnail
                            key={thumbUrl}
                            url={Url.isValid(thumbUrl) ? thumbUrl : null}
                            name={name || 'novo produto'}
                            size="lg"
                          />
                          <div className="flex flex-col gap-4">
                            <div>
                              <Label htmlFor={`product-image-${index}-thumb`}>URL da miniatura</Label>
                              <Input
                                id={`product-image-${index}-thumb`}
                                type="url"
                                inputMode="url"
                                autoComplete="off"
                                placeholder="https://exemplo.com/miniatura.jpg"
                                value={item.thumbUrl}
                                aria-invalid={itemErrors?.thumbUrl ? true : undefined}
                                disabled={isSubmitting}
                                onChange={(event) => updateImage(index, 'thumbUrl', event.target.value)}
                                onBlur={field.onBlur}
                              />
                              <FieldFeedback error={itemErrors?.thumbUrl?.message} />
                            </div>
                            <div>
                              <Label htmlFor={`product-image-${index}-large`}>URL da imagem grande</Label>
                              <Input
                                id={`product-image-${index}-large`}
                                type="url"
                                inputMode="url"
                                autoComplete="off"
                                placeholder="https://exemplo.com/imagem-grande.jpg"
                                value={item.largeUrl}
                                aria-invalid={itemErrors?.largeUrl ? true : undefined}
                                disabled={isSubmitting}
                                onChange={(event) => updateImage(index, 'largeUrl', event.target.value)}
                                onBlur={field.onBlur}
                              />
                              <FieldFeedback error={itemErrors?.largeUrl?.message} />
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {errors.images?.message ? (
                      <FormErrorMessage>{errors.images.message}</FormErrorMessage>
                    ) : (
                      <p className="text-xs tabular-nums text-muted-ink">
                        {images.length} de {PRODUCT_MAX_IMAGES} imagens
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSubmitting || limitReached}
                      title={limitReached ? `O produto pode ter no máximo ${PRODUCT_MAX_IMAGES} imagens.` : undefined}
                      onClick={() => field.onChange([...images, { ...EMPTY_IMAGE }])}
                    >
                      <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
                      Adicionar imagem
                    </Button>
                  </div>
                </div>
              );
            }}
          />
        </FormSectionLayout>

        <FormSectionLayout
          title="Publicação"
          description={
            isEditing
              ? 'Destaque na página inicial da loja. Produtos inativos continuam cadastrados, mas ficam fora da vitrine.'
              : 'Destaque na página inicial da loja.'
          }
          showDivider={false}
          className="pt-10"
        >
          <Controller
            control={control}
            name="isFeatured"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Checkbox
                  id="product-is-featured"
                  ref={field.ref}
                  checked={field.value === true}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                  aria-describedby="product-is-featured-hint"
                  className="mt-px"
                />
                <div>
                  <Label htmlFor="product-is-featured" className="leading-[18px]">
                    Destaque na vitrine
                  </Label>
                  <p id="product-is-featured-hint" className="mt-1 text-xs text-muted-ink">
                    Aparece em “Em destaque” na página inicial da loja
                  </p>
                </div>
              </div>
            )}
          />

          {isEditing ? (
            <Controller
              control={control}
              name="isActive"
              render={({ field }) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="product-is-active"
                    ref={field.ref}
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    onBlur={field.onBlur}
                    disabled={isSubmitting}
                    className="mt-px"
                  />
                  <Label htmlFor="product-is-active" className="leading-[18px]">
                    Produto ativo
                  </Label>
                </div>
              )}
            />
          ) : null}
        </FormSectionLayout>
      </Card>

      {rootError ? (
        <div className="rounded-xl bg-danger-soft px-4 py-3">
          <FormErrorMessage size="sm">{rootError}</FormErrorMessage>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'salvando...' : isEditing ? 'Salvar alterações' : 'Criar produto'}
        </Button>
      </div>
    </form>
  );
}
