'use client';

import { useCallback, useEffect, useState } from 'react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/lib/class-name.util';
import {
  formatRadius,
  isGoogleMapsConfigured,
  STORE_MAX_DELIVERY_RADIUS_METERS,
  STORE_MIN_DELIVERY_RADIUS_METERS,
  STORE_MOCK_LOCATION,
  STORE_RADIUS_STEP_METERS,
} from '../data/store-location.util';
import type { StoreFormData } from '../data/store.schema';
import { StoreLocationMap } from './store-location-map.component';
import { StoreLocationMock } from './store-location-mock.component';

/** Aviso exibido quando a chave pública existe, mas o Google Maps não carregou. */
export const STORE_MAP_LOAD_ERROR_MESSAGE =
  'Não foi possível carregar o Google Maps (chave recusada ou sem conexão). Usando o mapa simulado.';

/** `window.gm_authFailure`: o Google chama essa função global quando recusa a chave. */
type GoogleMapsAuthWindow = Window & { gm_authFailure?: () => void };

type StoreLocationFieldProps = {
  form: UseFormReturn<StoreFormData>;
  token?: string;
  isEditing: boolean;
  disabled?: boolean;
};

/** Texto do campo numérico → número; vazio vira `undefined` (o schema acusa obrigatório). */
function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return Number(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Localização da loja. Usa o Google Maps quando há `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
 * e o carregamento não falhou; sem a chave, ou quando o `APIProvider` falha ou o
 * Google chama `window.gm_authFailure`, usa o mapa simulado (com o aviso da
 * falha). Abaixo do mapa ficam sempre os campos `latitude`, `longitude` e
 * `deliveryRadiusMeters`, a fonte da verdade da localização: editáveis com o
 * Google Maps e somente leitura no modo simulado.
 */
export function StoreLocationField({ form, token, isEditing, disabled }: StoreLocationFieldProps) {
  const {
    register,
    control,
    getValues,
    setValue,
    formState: { errors },
  } = form;

  const [loadFailed, setLoadFailed] = useState(false);
  const useGoogleMaps = isGoogleMapsConfigured && !loadFailed;
  const readOnly = !useGoogleMaps;

  const radius = useWatch({ control, name: 'deliveryRadiusMeters' });

  const handleLoadError = useCallback(() => setLoadFailed(true), []);

  // Chave recusada: o Google chama `gm_authFailure` depois de carregar o script.
  useEffect(() => {
    if (!useGoogleMaps) return;

    const authWindow = window as GoogleMapsAuthWindow;
    const previous = authWindow.gm_authFailure;
    authWindow.gm_authFailure = () => {
      previous?.();
      setLoadFailed(true);
    };

    return () => {
      authWindow.gm_authFailure = previous;
    };
  }, [useGoogleMaps]);

  // Falha de carregamento na criação ainda sem ponto: começa com o ponto simulado, como sem chave.
  useEffect(() => {
    if (!loadFailed || isEditing) return;
    if (isFiniteNumber(getValues('latitude')) || isFiniteNumber(getValues('longitude'))) return;

    setValue('latitude', STORE_MOCK_LOCATION.latitude);
    setValue('longitude', STORE_MOCK_LOCATION.longitude);
    setValue('deliveryRadiusMeters', STORE_MOCK_LOCATION.deliveryRadiusMeters);
  }, [loadFailed, isEditing, getValues, setValue]);

  const numberClassName = cn('tabular-nums', readOnly && 'bg-surface text-muted-ink');

  return (
    <div className="flex flex-col gap-4">
      {loadFailed ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13px] font-semibold text-warning">
          {STORE_MAP_LOAD_ERROR_MESSAGE}
        </p>
      ) : null}

      {useGoogleMaps ? (
        <StoreLocationMap form={form} token={token} onLoadError={handleLoadError} />
      ) : (
        <StoreLocationMock form={form} isEditing={isEditing} disabled={disabled} />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="store-latitude">Latitude</Label>
          <Input
            id="store-latitude"
            type="number"
            inputMode="decimal"
            step="0.000001"
            autoComplete="off"
            readOnly={readOnly}
            aria-invalid={errors.latitude ? true : undefined}
            disabled={disabled}
            className={numberClassName}
            {...register('latitude', { setValueAs: toOptionalNumber })}
          />
          {errors.latitude?.message ? (
            <FormErrorMessage className="mt-1.5">{errors.latitude.message}</FormErrorMessage>
          ) : null}
        </div>

        <div>
          <Label htmlFor="store-longitude">Longitude</Label>
          <Input
            id="store-longitude"
            type="number"
            inputMode="decimal"
            step="0.000001"
            autoComplete="off"
            readOnly={readOnly}
            aria-invalid={errors.longitude ? true : undefined}
            disabled={disabled}
            className={numberClassName}
            {...register('longitude', { setValueAs: toOptionalNumber })}
          />
          {errors.longitude?.message ? (
            <FormErrorMessage className="mt-1.5">{errors.longitude.message}</FormErrorMessage>
          ) : null}
        </div>

        <div>
          <Label htmlFor="store-delivery-radius">Raio (metros)</Label>
          <Input
            id="store-delivery-radius"
            type="number"
            inputMode="numeric"
            step={STORE_RADIUS_STEP_METERS}
            autoComplete="off"
            readOnly={readOnly}
            aria-invalid={errors.deliveryRadiusMeters ? true : undefined}
            disabled={disabled}
            className={numberClassName}
            {...register('deliveryRadiusMeters', { setValueAs: toOptionalNumber })}
          />
          {errors.deliveryRadiusMeters?.message ? (
            <FormErrorMessage className="mt-1.5">{errors.deliveryRadiusMeters.message}</FormErrorMessage>
          ) : (
            <p className="mt-1.5 text-xs text-muted-ink tabular-nums">
              {isFiniteNumber(radius) ? `${formatRadius(radius)} · ` : ''}
              de {formatRadius(STORE_MIN_DELIVERY_RADIUS_METERS)} a {formatRadius(STORE_MAX_DELIVERY_RADIUS_METERS)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
