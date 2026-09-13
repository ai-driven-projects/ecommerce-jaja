'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { v } from '@/shared/components/form/validator';
import { getMessage } from '@/shared/i18n';
import { CATALOG_CATEGORIES_ROUTE } from '@/shared/navigation/catalog-routes';
import { ApiError, toErrorMessage } from '@/shared/util/api-client.util';
import {
  createCategory,
  getCategory,
  updateCategory,
  type CatalogCategory,
  type CategoryInput,
} from './category.api';
import { categorySchema, type CategoryFormData } from './category.schema';
import { getDescendantIds } from './category.util';
import { useCategories } from './use-categories.hook';

/** Maior nível que ainda aceita filhas (a hierarquia tem no máximo 3). */
const MAX_PARENT_LEVEL = 2;

/** Valor da opção "Sem categoria pai (raiz)"; vira `parentId: null` no envio. */
export const ROOT_PARENT_VALUE = '';

export const ROOT_PARENT_LABEL = 'Sem categoria pai (raiz)';

export type CategoryParentOption = {
  label: string;
  value: string;
};

type CategoryFormField = 'slug' | 'parentId';

/** Rejeições da API e o campo do formulário que cada uma aponta. */
const FIELD_BY_CODE: Readonly<Record<string, CategoryFormField>> = {
  CATEGORY_SLUG_ALREADY_EXISTS: 'slug',
  PARENT_CATEGORY_NOT_FOUND: 'parentId',
  CATEGORY_MAX_DEPTH_EXCEEDED: 'parentId',
  CATEGORY_CYCLE: 'parentId',
};

function emptyValues(parentId?: string): CategoryFormData {
  return {
    parentId: parentId ?? ROOT_PARENT_VALUE,
    name: '',
    slug: '',
    description: '',
    order: 0,
    isHighlighted: false,
    imageUrl: '',
    isActive: true,
  };
}

function toFormValues(category: CatalogCategory): CategoryFormData {
  return {
    parentId: category.parentId ?? ROOT_PARENT_VALUE,
    name: category.name,
    slug: category.slug,
    description: category.description ?? '',
    order: category.order,
    isHighlighted: category.isHighlighted,
    imageUrl: category.imageUrl ?? '',
    isActive: category.isActive,
  };
}

export type UseCategoryFormOptions = {
  /** Sem `id` cria; com `id` carrega e altera. */
  id?: string;
  /** Pai pré-selecionada na criação (`?parentId=`). */
  parentId?: string;
};

/**
 * Estado do formulário de categoria em página. Carrega a lista de categorias
 * para montar as opções de pai (níveis 1 e 2 rotulados pelo `path`, sem a
 * própria categoria e suas descendentes na edição). Com `id`, carrega a
 * categoria (falha, como `404 CATEGORY_NOT_FOUND`, vira toaster e volta para a
 * árvore). No envio, `CATEGORY_SLUG_ALREADY_EXISTS` aponta o campo `slug` e
 * `PARENT_CATEGORY_NOT_FOUND`, `CATEGORY_MAX_DEPTH_EXCEEDED` e `CATEGORY_CYCLE`
 * o campo `parentId`; os demais erros viram toaster, mantendo os valores.
 * Sucesso avisa e volta para a árvore, que é remontada e busca de novo.
 */
export function useCategoryForm({ id, parentId }: UseCategoryFormOptions = {}) {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const isEditing = id !== undefined;

  const { categories, isLoading: categoriesLoading } = useCategories();

  const form = useForm<CategoryFormData>({
    resolver: v.resolver(categorySchema),
    defaultValues: emptyValues(isEditing ? undefined : parentId),
  });
  const { reset, setError, setValue } = form;

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = categoriesLoading || (isEditing && loadedId !== id);

  const parentOptions = useMemo<CategoryParentOption[]>(() => {
    const excluded = id ? getDescendantIds(categories, id) : new Set<string>();

    const options = categories
      .filter((category) => category.level <= MAX_PARENT_LEVEL && category.id !== id && !excluded.has(category.id))
      .map((category) => ({ label: category.path, value: category.id }));

    return [{ label: ROOT_PARENT_LABEL, value: ROOT_PARENT_VALUE }, ...options];
  }, [categories, id]);

  // `?parentId=` que não é uma pai possível (inexistente ou de nível 3) volta para a raiz.
  useEffect(() => {
    if (isEditing || !parentId || categoriesLoading) return;
    if (!parentOptions.some((option) => option.value === parentId)) {
      setValue('parentId', ROOT_PARENT_VALUE);
    }
  }, [isEditing, parentId, categoriesLoading, parentOptions, setValue]);

  useEffect(() => {
    if (!id || !token) return;

    let cancelled = false;

    getCategory(token, id)
      .then((category) => {
        if (cancelled) return;
        reset(toFormValues(category));
        setLoadedId(id);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        router.replace(CATALOG_CATEGORIES_ROUTE);
      });

    return () => {
      cancelled = true;
    };
  }, [id, token, reset, router]);

  const onSubmit = async (data: CategoryFormData) => {
    if (!token) return;

    // Envia sempre o objeto completo: opcionais vazios chegam `undefined` do resolver e vão
    // como `null` (raiz, sem descrição, sem imagem), para limpar os valores na alteração.
    const input: CategoryInput = {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      parentId: data.parentId || null,
      order: data.order,
      isHighlighted: data.isHighlighted,
      imageUrl: data.imageUrl || null,
      isActive: isEditing ? data.isActive : true,
    };

    try {
      if (id) {
        await updateCategory(token, id, input);
        toast.success('Categoria atualizada');
      } else {
        await createCategory(token, input);
        toast.success('Categoria criada');
      }
      router.push(CATALOG_CATEGORIES_ROUTE);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldErrors = error.codes.filter((code) => FIELD_BY_CODE[code]);

        if (fieldErrors.length > 0) {
          const reported = new Set<CategoryFormField>();

          fieldErrors.forEach((code) => {
            const field = FIELD_BY_CODE[code];
            if (reported.has(field)) return;

            setError(field, { type: 'server', message: getMessage(code) }, { shouldFocus: reported.size === 0 });
            reported.add(field);
          });
          return;
        }
      }

      toast.error(toErrorMessage(error));
    }
  };

  return {
    form,
    isEditing,
    loading,
    parentOptions,
    submit: form.handleSubmit(onSubmit),
  };
}
