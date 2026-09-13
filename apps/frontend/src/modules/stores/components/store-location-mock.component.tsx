'use client';

import { useId, useState } from 'react';
import Image from 'next/image';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { badgeVariants } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/class-name.util';
import { formatRadius, STORE_MOCK_LOCATION } from '../data/store-location.util';
import type { StoreFormData } from '../data/store.schema';

/** Legenda do mapa simulado (texto exigido pela spec `stores/store-admin`). */
export const STORE_MOCK_MAP_CAPTION =
  'Google Maps indisponível: configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. A localização usa um ponto fixo de exemplo (Avenida Paulista, 1578 – São Paulo/SP) com raio de 1 km.';

type StoreLocationMockProps = {
  form: UseFormReturn<StoreFormData>;
  isEditing: boolean;
  disabled?: boolean;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Mapa simulado, sem nenhuma chamada ao Google: uma ilustração própria
 * (`/images/store-map-mock.svg`) com o selo "Mapa simulado". A imagem é um
 * botão ("Usar ponto simulado", ativado por clique, Enter ou Espaço) que grava
 * sempre `STORE_MOCK_LOCATION`. Na edição, o ponto salvo é preservado e
 * exibido até o administrador selecionar a imagem.
 */
export function StoreLocationMock({ form, isEditing, disabled }: StoreLocationMockProps) {
  const { control, setValue } = form;
  const captionId = useId();
  const [applied, setApplied] = useState(false);

  const latitude = useWatch({ control, name: 'latitude' });
  const longitude = useWatch({ control, name: 'longitude' });
  const radius = useWatch({ control, name: 'deliveryRadiusMeters' });

  const applyMockLocation = () => {
    const options = { shouldDirty: true, shouldValidate: true };
    setValue('latitude', STORE_MOCK_LOCATION.latitude, options);
    setValue('longitude', STORE_MOCK_LOCATION.longitude, options);
    setValue('deliveryRadiusMeters', STORE_MOCK_LOCATION.deliveryRadiusMeters, options);
    setApplied(true);
  };

  const hasSavedPoint = isFiniteNumber(latitude) && isFiniteNumber(longitude) && isFiniteNumber(radius);

  return (
    <figure className="flex flex-col gap-2.5">
      <button
        type="button"
        aria-label="Usar ponto simulado"
        aria-describedby={captionId}
        onClick={applyMockLocation}
        disabled={disabled}
        className="relative block w-full overflow-hidden rounded-2xl border border-line bg-map transition-shadow duration-150 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Image
          src="/images/store-map-mock.svg"
          alt=""
          width={640}
          height={360}
          unoptimized
          className="block h-auto w-full"
        />
        <span className={cn(badgeVariants({ variant: 'outline' }), 'absolute left-3 top-3 shadow-float')}>
          Mapa simulado
        </span>
      </button>

      <figcaption id={captionId} className="text-xs text-muted-ink">
        {STORE_MOCK_MAP_CAPTION}
      </figcaption>

      {isEditing && !applied && hasSavedPoint ? (
        <p className="rounded-xl bg-surface px-3.5 py-2.5 text-[13px] text-ink-soft tabular-nums">
          Ponto salvo: {latitude}, {longitude} · raio {formatRadius(radius)}
        </p>
      ) : null}

      {applied ? (
        <p className="rounded-xl bg-brand-soft px-3.5 py-2.5 text-[13px] font-semibold text-ink" role="status">
          Ponto simulado aplicado: {STORE_MOCK_LOCATION.label} · raio{' '}
          {formatRadius(STORE_MOCK_LOCATION.deliveryRadiusMeters)}.
        </p>
      ) : isEditing ? (
        <p className="text-xs text-muted-ink">Clique na imagem ou pressione Enter para usar o ponto simulado.</p>
      ) : null}
    </figure>
  );
}
