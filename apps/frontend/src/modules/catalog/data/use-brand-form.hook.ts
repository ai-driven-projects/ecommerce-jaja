'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { v } from '@/shared/components/form/validator';
import { getMessage } from '@/shared/i18n';
import { catalogBrandsRoute } from '@/shared/navigation/catalog-routes';
import { ApiError, toErrorMessage } from '@/shared/util/api-client.util';
import { createBrand, getBrand, updateBrand, type Brand, type BrandInput } from './brand.api';
import { brandSchema, type BrandFormData } from './brand.schema';

/** Conflitos de unicidade da API e o campo do formulário que cada um aponta. */
const CONFLICT_FIELD_BY_CODE: Readonly<Record<string, 'name' | 'slug'>> = {
  BRAND_NAME_ALREADY_EXISTS: 'name',
  BRAND_SLUG_ALREADY_EXISTS: 'slug',
};

const EMPTY_VALUES: BrandFormData = {
  name: '',
  slug: '',
  description: '',
  logoUrl: '',
  isActive: true,
};

function toFormValues(brand: Brand): BrandFormData {
  return {
    name: brand.name,
    slug: brand.slug,
    description: brand.description ?? '',
    logoUrl: brand.logoUrl ?? '',
    isActive: brand.isActive,
  };
}

export type UseBrandFormOptions = {
  /** Sem `id` cria; com `id` carrega e altera. */
  id?: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto, usada no retorno. */
  returnQuery?: string;
};

/**
 * Estado do formulário de marca em página. Sem `id` cria; com `id` carrega a
 * marca (falha, como `404 BRAND_NOT_FOUND`, vira toaster e volta para a lista)
 * e altera. No envio, conflito `409` vira erro no campo `name`/`slug` pelo
 * código; os demais erros viram toaster. Sucesso avisa e volta para a lista na
 * mesma página e busca de origem (`listHref`), que busca de novo.
 */
export function useBrandForm({ id, returnQuery = '' }: UseBrandFormOptions = {}) {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const isEditing = id !== undefined;
  const listHref = catalogBrandsRoute(returnQuery);

  const form = useForm<BrandFormData>({
    resolver: v.resolver(brandSchema),
    defaultValues: EMPTY_VALUES,
  });
  const { reset, setError } = form;

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = isEditing && loadedId !== id;

  useEffect(() => {
    if (!id || !token) return;

    let cancelled = false;

    getBrand(token, id)
      .then((brand) => {
        if (cancelled) return;
        reset(toFormValues(brand));
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

  const onSubmit = async (data: BrandFormData) => {
    if (!token) return;

    // Campos opcionais vazios chegam `undefined` do resolver e vão como `null` (limpa na alteração).
    const input: BrandInput = {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      logoUrl: data.logoUrl || null,
      ...(isEditing ? { isActive: data.isActive } : {}),
    };

    try {
      if (id) {
        await updateBrand(token, id, input);
        toast.success('Marca atualizada');
      } else {
        await createBrand(token, input);
        toast.success('Marca criada');
      }
      router.push(listHref);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const conflicts = error.codes.filter((code) => CONFLICT_FIELD_BY_CODE[code]);

        if (conflicts.length > 0) {
          conflicts.forEach((code, index) => {
            setError(
              CONFLICT_FIELD_BY_CODE[code],
              { type: 'server', message: getMessage(code) },
              { shouldFocus: index === 0 },
            );
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
    submit: form.handleSubmit(onSubmit),
  };
}
