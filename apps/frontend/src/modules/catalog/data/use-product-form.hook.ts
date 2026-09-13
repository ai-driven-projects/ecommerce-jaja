'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch, type DefaultValues } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { v } from '@/shared/components/form/validator';
import { getMessage } from '@/shared/i18n';
import { catalogProductsRoute } from '@/shared/navigation/catalog-routes';
import { ApiError, toErrorMessage } from '@/shared/util/api-client.util';
import { createProduct, getProduct, updateProduct, type CatalogProduct, type ProductInput } from './product.api';
import { PRODUCT_DEFAULT_UNIT, productSchema, type ProductFormData } from './product.schema';
import { useBrandOptions, type BrandOption, type BrandSelectState } from './use-brand-options.hook';
import { useProductOptions } from './use-product-options.hook';

/** Valor da opção "Sem marca"; vira `brandId: null` no envio. */
export const NO_BRAND_VALUE = '';

export const NO_BRAND_LABEL = 'Sem marca';

const NO_BRAND_OPTION: BrandOption = { label: NO_BRAND_LABEL, value: NO_BRAND_VALUE };

type ProductFormField = 'slug' | 'sku' | 'brandId' | 'categoryId';

/** Rejeições da API e o campo do formulário que cada uma aponta. */
const FIELD_BY_CODE: Readonly<Record<string, ProductFormField>> = {
  PRODUCT_SLUG_ALREADY_EXISTS: 'slug',
  PRODUCT_SKU_ALREADY_EXISTS: 'sku',
  BRAND_NOT_FOUND: 'brandId',
  CATEGORY_NOT_FOUND: 'categoryId',
};

// Preço vazio na criação: o campo começa sem valor e o resolver acusa "obrigatório".
const EMPTY_VALUES: DefaultValues<ProductFormData> = {
  name: '',
  slug: '',
  sku: '',
  brandId: NO_BRAND_VALUE,
  categoryId: '',
  description: '',
  listPrice: undefined,
  unit: PRODUCT_DEFAULT_UNIT,
  images: [],
  isActive: true,
};

/** Centavos da API → reais do formulário (`390` → `3.9`). */
export function centsToReais(cents: number): number {
  return cents / 100;
}

/** Reais do formulário → centavos inteiros da API (`12.9` → `1290`). */
export function reaisToCents(reais: number): number {
  return Math.round(reais * 100);
}

function toFormValues(product: CatalogProduct): ProductFormData {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku ?? '',
    brandId: product.brandId ?? NO_BRAND_VALUE,
    categoryId: product.categoryId,
    description: product.description ?? '',
    price: centsToReais(product.priceCents),
    listPrice: product.listPriceCents === null ? undefined : centsToReais(product.listPriceCents),
    unit: product.unit,
    images: [...product.images]
      .sort((a, b) => a.order - b.order)
      .map(({ thumbUrl, largeUrl }) => ({ thumbUrl, largeUrl })),
    isActive: product.isActive,
  };
}

/** Falha ao carregar o produto da edição. */
export type ProductLoadError = {
  notFound: boolean;
  message: string;
};

type LoadState = {
  id: string;
  error: ProductLoadError | null;
};

export type UseProductFormOptions = {
  /** Sem `id` cria; com `id` carrega e altera. */
  id?: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto, usada no retorno. */
  returnQuery?: string;
};

/**
 * Estado do formulário de produto em página. Carrega as opções de categoria
 * (rotuladas pelo `path`), o seletor de marca com busca na API e "Carregar
 * mais" ("Sem marca" + marcas; a marca do produto carregado já vem rotulada
 * pelo `brandName`) e, com `id`, o produto, convertendo os preços de centavos
 * para reais; `404` (ou id malformado) vira `loadError.notFound`. No envio,
 * converte reais para centavos, gera `images[].order` pela posição e manda a
 * lista completa; `PRODUCT_SLUG_ALREADY_EXISTS`, `PRODUCT_SKU_ALREADY_EXISTS`,
 * `BRAND_NOT_FOUND` e `CATEGORY_NOT_FOUND` apontam o campo e os demais erros
 * viram a mensagem geral `errors.root.server`, mantendo os valores. Sucesso
 * avisa com toaster e volta para a lista com a query de origem (`listHref`),
 * que busca de novo.
 */
export function useProductForm({ id, returnQuery = '' }: UseProductFormOptions = {}) {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const isEditing = id !== undefined;
  const listHref = catalogProductsRoute(returnQuery);

  const form = useForm<ProductFormData>({
    resolver: v.resolver(productSchema),
    defaultValues: EMPTY_VALUES,
  });
  const { reset, setError, control } = form;

  const { categoryOptions, loading: optionsLoading } = useProductOptions();

  // Marca do produto carregado: rotula o valor inicial sem esperar a página em que ela aparece.
  const [loadedBrand, setLoadedBrand] = useState<BrandOption | null>(null);
  const brandId = useWatch({ control, name: 'brandId' }) ?? NO_BRAND_VALUE;
  const brands = useBrandOptions({
    selectedId: brandId || undefined,
    selectedLabel: loadedBrand && loadedBrand.value === brandId ? loadedBrand.label : undefined,
  });

  const brandSelect: BrandSelectState = {
    ...brands,
    options: brands.search.trim() ? brands.options : [NO_BRAND_OPTION, ...brands.options],
    selectedOption: brandId ? brands.selectedOption : NO_BRAND_OPTION,
  };

  const [loadState, setLoadState] = useState<LoadState | null>(null);
  const productLoaded = !isEditing || loadState?.id === id;
  const loadError = isEditing && loadState?.id === id ? loadState.error : null;
  const loading = !loadError && (optionsLoading || !productLoaded);

  useEffect(() => {
    if (!id || !token) return;

    let cancelled = false;

    getProduct(token, id)
      .then((product) => {
        if (cancelled) return;
        reset(toFormValues(product));
        setLoadedBrand(
          product.brandId && product.brandName ? { value: product.brandId, label: product.brandName } : null,
        );
        setLoadState({ id, error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const notFound =
          error instanceof ApiError && (error.status === 404 || error.codes.includes('INVALID_ID'));
        setLoadState({
          id,
          error: { notFound, message: notFound ? getMessage('PRODUCT_NOT_FOUND') : toErrorMessage(error) },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id, token, reset]);

  const onSubmit = async (data: ProductFormData) => {
    if (!token) return;

    // Envia sempre o objeto completo: opcionais vazios chegam `undefined` do resolver e vão
    // como `null` (sem sku, sem marca, sem descrição, sem preço "De:") para limpar na alteração.
    const input: ProductInput = {
      name: data.name,
      slug: data.slug,
      sku: data.sku || null,
      brandId: data.brandId || null,
      categoryId: data.categoryId,
      description: data.description || null,
      priceCents: reaisToCents(data.price),
      listPriceCents: data.listPrice === undefined ? null : reaisToCents(data.listPrice),
      unit: data.unit,
      images: data.images.map((image, order) => ({ thumbUrl: image.thumbUrl, largeUrl: image.largeUrl, order })),
      ...(isEditing ? { isActive: data.isActive } : {}),
    };

    try {
      if (id) {
        await updateProduct(token, id, input);
        toast.success('Produto atualizado');
      } else {
        await createProduct(token, input);
        toast.success('Produto criado');
      }
      router.push(listHref);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.codes.filter((code) => FIELD_BY_CODE[code]);

        if (fieldErrors.length > 0) {
          const reported = new Set<ProductFormField>();

          fieldErrors.forEach((code) => {
            const field = FIELD_BY_CODE[code];
            if (reported.has(field)) return;

            setError(field, { type: 'server', message: getMessage(code) }, { shouldFocus: reported.size === 0 });
            reported.add(field);
          });
          return;
        }
      }

      setError('root.server', { type: 'server', message: toErrorMessage(error) });
    }
  };

  return {
    form,
    isEditing,
    loading,
    loadError,
    brandSelect,
    categoryOptions,
    listHref,
    submit: form.handleSubmit(onSubmit),
  };
}
