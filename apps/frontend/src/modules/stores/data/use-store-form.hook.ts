'use client';

import { useEffect, useState } from 'react';
import { useForm, type DefaultValues } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/modules/auth/data/auth.context';
import { v } from '@/shared/components/form/validator';
import { getMessage } from '@/shared/i18n';
import { storesRoute } from '@/shared/navigation/stores-routes';
import { ApiError, toErrorMessage } from '@/shared/util/api-client.util';
import { formatPhone, onlyDigits } from '@/shared/util/phone.util';
import { createStore, getStore, updateStore, type Store, type StoreInput } from './store.api';
import { isGoogleMapsConfigured } from '@/shared/maps/google-maps.config';
import { STORE_DEFAULT_DELIVERY_RADIUS_METERS, STORE_MOCK_LOCATION } from './store-location.util';
import { storeSchema, type StoreFormData } from './store.schema';

type StoreFormField = 'name' | 'slug' | 'phone' | 'latitude' | 'longitude' | 'deliveryRadiusMeters';

/** Rejeições da API (conflito `409` ou validação `400`) e o campo do formulário que cada uma aponta. */
const CONFLICT_FIELD_BY_CODE: Readonly<Record<string, StoreFormField>> = {
  STORE_NAME_ALREADY_EXISTS: 'name',
  STORE_SLUG_ALREADY_EXISTS: 'slug',
  PHONE_INVALID_FORMAT: 'phone',
  PHONE_INVALID_LENGTH: 'phone',
  GEO_POINT_LATITUDE_INVALID: 'latitude',
  GEO_POINT_LONGITUDE_INVALID: 'longitude',
  DELIVERY_RADIUS_INVALID: 'deliveryRadiusMeters',
};

/**
 * Valores da criação: raio de 1.000 m e, no modo simulado (sem chave pública do
 * Google), o ponto e o raio simulados já preenchidos. Com a chave, o ponto
 * começa vazio até o administrador marcá-lo no mapa.
 */
const CREATE_VALUES: DefaultValues<StoreFormData> = {
  name: '',
  slug: '',
  phone: '',
  address: '',
  latitude: isGoogleMapsConfigured ? undefined : STORE_MOCK_LOCATION.latitude,
  longitude: isGoogleMapsConfigured ? undefined : STORE_MOCK_LOCATION.longitude,
  deliveryRadiusMeters: isGoogleMapsConfigured
    ? STORE_DEFAULT_DELIVERY_RADIUS_METERS
    : STORE_MOCK_LOCATION.deliveryRadiusMeters,
  isActive: true,
};

function toFormValues(store: Store): StoreFormData {
  return {
    name: store.name,
    slug: store.slug,
    phone: formatPhone(store.phone),
    address: store.address ?? '',
    latitude: store.latitude,
    longitude: store.longitude,
    deliveryRadiusMeters: store.deliveryRadiusMeters,
    isActive: store.isActive,
  };
}

export type UseStoreFormOptions = {
  /** Sem `id` cria; com `id` carrega e altera. */
  id?: string;
  /** Query string da lista (sem `?`) de onde o formulário foi aberto, usada no retorno. */
  returnQuery?: string;
};

/**
 * Estado do formulário de loja em página. Sem `id` cria (valores de
 * `CREATE_VALUES`); com `id` carrega a loja (falha, como `404 STORE_NOT_FOUND`,
 * vira toaster e volta para a lista) e altera, preservando o ponto salvo. No
 * envio, opcionais vazios vão como `null`, o telefone só com dígitos e
 * `isActive` apenas na edição. Códigos de `CONFLICT_FIELD_BY_CODE` viram erro
 * no campo; os demais viram toaster. Sucesso avisa e volta para a lista na
 * mesma página e busca de origem (`listHref`), que busca de novo.
 */
export function useStoreForm({ id, returnQuery = '' }: UseStoreFormOptions = {}) {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const isEditing = id !== undefined;
  const listHref = storesRoute(returnQuery);

  const form = useForm<StoreFormData>({
    resolver: v.resolver(storeSchema),
    defaultValues: CREATE_VALUES,
  });
  const { reset, setError } = form;

  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = isEditing && loadedId !== id;

  useEffect(() => {
    if (!id || !token) return;

    let cancelled = false;

    getStore(token, id)
      .then((store) => {
        if (cancelled) return;
        reset(toFormValues(store));
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

  const onSubmit = async (data: StoreFormData) => {
    if (!token) return;

    // Campos opcionais vazios chegam `undefined` do resolver e vão como `null` (limpa na alteração).
    const input: StoreInput = {
      name: data.name,
      slug: data.slug,
      phone: data.phone ? onlyDigits(data.phone) : null,
      address: data.address || null,
      latitude: data.latitude,
      longitude: data.longitude,
      deliveryRadiusMeters: data.deliveryRadiusMeters,
      ...(isEditing ? { isActive: data.isActive } : {}),
    };

    try {
      if (id) {
        await updateStore(token, id, input);
        toast.success('Loja atualizada');
      } else {
        await createStore(token, input);
        toast.success('Loja criada');
      }
      router.push(listHref);
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldCodes = error.codes.filter((code) => CONFLICT_FIELD_BY_CODE[code]);

        if (fieldCodes.length > 0) {
          const marked = new Set<StoreFormField>();
          fieldCodes.forEach((code) => {
            const field = CONFLICT_FIELD_BY_CODE[code];
            if (marked.has(field)) return;
            setError(field, { type: 'server', message: getMessage(code) }, { shouldFocus: marked.size === 0 });
            marked.add(field);
          });

          const otherCodes = error.codes.filter((code) => !CONFLICT_FIELD_BY_CODE[code]);
          if (otherCodes.length > 0) toast.error(otherCodes.map((code) => getMessage(code)).join(' '));
          return;
        }
      }

      toast.error(toErrorMessage(error));
    }
  };

  return {
    form,
    token,
    isEditing,
    loading,
    listHref,
    submit: form.handleSubmit(onSubmit),
  };
}
