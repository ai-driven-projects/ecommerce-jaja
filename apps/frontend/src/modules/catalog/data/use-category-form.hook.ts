'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { v } from '@/shared/components/form/validator';
import { getMessage } from '@/shared/i18n';
import { catalogCategoriesRoute } from '@/shared/navigation/catalog-routes';
import { ApiError, toErrorMessage } from '@/shared/util/api-client.util';
import {
  createCategory,
  getCategory,
  updateCategory,
  type CatalogCategory,
  type CategoryInput,
} from './category.api';
import { categorySchema, type CategoryFormData } from './category.schema';
import { useCategoryOptions, type CategoryOption, type CategorySelectState } from './use-category-options.hook';

/** Maior nível que ainda aceita filhas (a hierarquia tem no máximo 3). */
const MAX_PARENT_LEVEL = 2;

/** Valor da opção "Sem categoria pai (raiz)"; vira `parentId: null` no envio. */
export const ROOT_PARENT_VALUE = '';

export const ROOT_PARENT_LABEL = 'Sem categoria pai (raiz)';

const ROOT_PARENT_OPTION: CategoryOption = { label: ROOT_PARENT_LABEL, value: ROOT_PARENT_VALUE };

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

/** Opção da pai a partir do caminho da filha (`"Escolar / Borrachas"` → `"Escolar"`), sem nova busca. */
function parentOptionOf(category: CatalogCategory): CategoryOption | null {
  if (!category.parentId) return null;

  const suffix = ` / ${category.name}`;
  if (!category.path.endsWith(suffix)) return null;

  return { value: category.parentId, label: category.path.slice(0, -suffix.length) };
}

export type UseCategoryFormOptions = {
  /** Sem `id` cria; com `id` carrega e altera. */
  id?: string;
  /** Pai pré-selecionada na criação (`?parentId=`). */
  parentId?: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto, usada no retorno. */
  returnQuery?: string;
};

/**
 * Estado do formulário de categoria em página.
 *
 * O seletor de pai (`parentSelect`) busca na API só categorias de nível 1 e 2,
 * rotuladas pelo caminho, 20 por vez e, na edição, sem a própria categoria e
 * suas descendentes; "Sem categoria pai (raiz)" fica no topo enquanto não há
 * texto de busca. Na criação, `?parentId=` é conferido por `GET /categories/:id`:
 * inexistente ou de nível 3 deixa a pai como raiz. Com `id`, carrega a
 * categoria (falha, como `404 CATEGORY_NOT_FOUND`, vira toaster e volta para a
 * lista).
 *
 * No envio, `CATEGORY_SLUG_ALREADY_EXISTS` aponta o campo `slug` e
 * `PARENT_CATEGORY_NOT_FOUND`, `CATEGORY_MAX_DEPTH_EXCEEDED` e `CATEGORY_CYCLE`
 * o campo `parentId`, focando o primeiro; os demais erros viram toaster,
 * mantendo os valores. Sucesso avisa e volta para a lista na mesma página e
 * busca de origem (`listHref`), que busca de novo.
 */
export function useCategoryForm({ id, parentId, returnQuery = '' }: UseCategoryFormOptions = {}) {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const isEditing = id !== undefined;
  const listHref = catalogCategoriesRoute(returnQuery);

  const form = useForm<CategoryFormData>({
    resolver: v.resolver(categorySchema),
    defaultValues: emptyValues(),
  });
  const { reset, setError, control } = form;

  // Pai já conhecida (da categoria carregada ou do `?parentId=`): rotula o valor sem esperar a página em que ela aparece.
  const [knownParent, setKnownParent] = useState<CategoryOption | null>(null);
  const selectedParentId = useWatch({ control, name: 'parentId' }) ?? ROOT_PARENT_VALUE;

  const parents = useCategoryOptions({
    maxLevel: MAX_PARENT_LEVEL,
    excludeSubtreeOf: id,
    selectedId: selectedParentId || undefined,
    selectedLabel: knownParent && knownParent.value === selectedParentId ? knownParent.label : undefined,
  });

  const parentSelect: CategorySelectState = {
    ...parents,
    options: parents.search.trim() ? parents.options : [ROOT_PARENT_OPTION, ...parents.options],
    selectedOption: selectedParentId ? parents.selectedOption : ROOT_PARENT_OPTION,
  };

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [checkedParentId, setCheckedParentId] = useState<string | null>(null);
  const loading = isEditing ? loadedId !== id : parentId !== undefined && checkedParentId !== parentId;

  // Criação com `?parentId=`: só pré-seleciona uma pai existente de nível 1 ou 2.
  useEffect(() => {
    if (isEditing || !parentId || !token) return;

    let cancelled = false;

    getCategory(token, parentId)
      .then((parent) => {
        if (cancelled) return;

        if (parent.level <= MAX_PARENT_LEVEL) {
          reset(emptyValues(parent.id));
          setKnownParent({ value: parent.id, label: parent.path });
        } else {
          reset(emptyValues());
        }
        setCheckedParentId(parentId);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // Pai inexistente (ou id malformado) cai na raiz sem aviso; falha de rede ou do servidor avisa.
        if (!(error instanceof ApiError && error.status < 500)) toast.error(toErrorMessage(error));
        reset(emptyValues());
        setCheckedParentId(parentId);
      });

    return () => {
      cancelled = true;
    };
  }, [isEditing, parentId, token, reset]);

  useEffect(() => {
    if (!id || !token) return;

    let cancelled = false;

    getCategory(token, id)
      .then((category) => {
        if (cancelled) return;
        reset(toFormValues(category));
        setKnownParent(parentOptionOf(category));
        setLoadedId(id);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error(toErrorMessage(error));
        router.replace(listHref);
      });

    return () => {
      cancelled = true;
    };
  }, [id, token, reset, router, listHref]);

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
      router.push(listHref);
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
    listHref,
    parentSelect,
    submit: form.handleSubmit(onSubmit),
  };
}
