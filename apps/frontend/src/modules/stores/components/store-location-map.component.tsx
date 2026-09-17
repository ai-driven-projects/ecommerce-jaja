'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdvancedMarker, APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import { LocateFixed } from 'lucide-react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { toErrorMessage } from '@/shared/util/api-client.util';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, roundCoordinate } from '@/shared/maps/google-maps.config';
import { geocodeAddress, MOCK_GEOCODING_WARNING, type GeocodingResult } from '../data/geocoding.api';
import {
  normalizeRadius,
  STORE_DEFAULT_DELIVERY_RADIUS_METERS,
  STORE_MAX_DELIVERY_RADIUS_METERS,
  STORE_MIN_DELIVERY_RADIUS_METERS,
  STORE_MOCK_LOCATION,
} from '../data/store-location.util';
import type { StoreFormData } from '../data/store.schema';

/** Zoom de rua (loja com ponto ou endereço localizado). */
const STREET_ZOOM = 15;
/** Zoom de cidade, para a loja nova ainda sem ponto. */
const CITY_ZOOM = 12;
/** Tamanho mínimo do endereço para a busca (o mesmo da API). */
const GEOCODE_MIN_LENGTH = 3;

/** Aviso exibido quando o backend responde a busca com o ponto simulado. */
export const STORE_MOCK_GEOCODING_WARNING = MOCK_GEOCODING_WARNING;

const BRAND_COLOR = '#FF6B00';

function isLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

function isRadius(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= STORE_MIN_DELIVERY_RADIUS_METERS &&
    value <= STORE_MAX_DELIVERY_RADIUS_METERS
  );
}

type StoreLocationMapProps = {
  form: UseFormReturn<StoreFormData>;
  token?: string;
  /** Falha ao carregar o Maps JavaScript API (erro do `APIProvider`). */
  onLoadError: () => void;
};

/**
 * Mapa do Google como editor dos campos `latitude`, `longitude` e
 * `deliveryRadiusMeters` (que continuam sendo a fonte da verdade): clique no
 * mapa ou arraste o marcador para mover o ponto e arraste a borda do círculo
 * para mudar o raio (múltiplos de 50 m, de 300 a 10.000 m). Inclui o botão
 * "Localizar endereço no mapa", que geocodifica o endereço de referência no backend.
 */
export function StoreLocationMap({ form, token, onLoadError }: StoreLocationMapProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="pt-BR" region="BR" onError={onLoadError}>
      <StoreLocationMapContent form={form} token={token} />
    </APIProvider>
  );
}

type StoreLocationMapContentProps = {
  form: UseFormReturn<StoreFormData>;
  token?: string;
};

function StoreLocationMapContent({ form, token }: StoreLocationMapContentProps) {
  const { control, getValues, setValue } = form;
  const map = useMap();

  const latitude = useWatch({ control, name: 'latitude' });
  const longitude = useWatch({ control, name: 'longitude' });
  const radius = useWatch({ control, name: 'deliveryRadiusMeters' });
  const address = useWatch({ control, name: 'address' }) ?? '';

  const pointLat = isLatitude(latitude) ? latitude : null;
  const pointLng = isLongitude(longitude) ? longitude : null;

  // Câmera inicial do mapa não controlado: o ponto da loja com zoom de rua, ou o
  // ponto simulado com zoom de cidade (e sem marcador) enquanto não houver ponto.
  const [initialCamera] = useState(() =>
    pointLat !== null && pointLng !== null
      ? { center: { lat: pointLat, lng: pointLng }, zoom: STREET_ZOOM }
      : { center: { lat: STORE_MOCK_LOCATION.latitude, lng: STORE_MOCK_LOCATION.longitude }, zoom: CITY_ZOOM },
  );

  const [locating, setLocating] = useState(false);
  const [located, setLocated] = useState<GeocodingResult | null>(null);

  const circleRef = useRef<google.maps.Circle | null>(null);
  // Verdadeiro enquanto o próprio componente altera o círculo: os listeners ignoram essas mudanças (sem laço).
  const applyingRef = useRef(false);

  /** Grava o ponto (6 casas) só nos campos que mudaram. */
  const setPoint = useCallback(
    (lat: number, lng: number) => {
      const options = { shouldDirty: true, shouldValidate: true };
      const nextLat = roundCoordinate(lat);
      const nextLng = roundCoordinate(lng);
      if (getValues('latitude') !== nextLat) setValue('latitude', nextLat, options);
      if (getValues('longitude') !== nextLng) setValue('longitude', nextLng, options);
    },
    [getValues, setValue],
  );

  /** Grava o raio normalizado (múltiplo de 50 m, limitado) se ele mudou; devolve o valor gravado. */
  const setRadius = useCallback(
    (meters: number) => {
      const next = normalizeRadius(meters);
      if (getValues('deliveryRadiusMeters') !== next) {
        setValue('deliveryRadiusMeters', next, { shouldDirty: true, shouldValidate: true });
      }
      return next;
    },
    [getValues, setValue],
  );

  // Círculo editável do raio (a biblioteca não tem componente pronto): criado uma vez por mapa.
  useEffect(() => {
    if (!map) return;

    const circle = new google.maps.Circle({
      map,
      editable: true,
      draggable: false,
      clickable: true,
      visible: false,
      fillColor: BRAND_COLOR,
      fillOpacity: 0.14,
      strokeColor: BRAND_COLOR,
      strokeOpacity: 0.9,
      strokeWeight: 2,
    });
    circleRef.current = circle;

    const listeners = [
      circle.addListener('radius_changed', () => {
        if (applyingRef.current) return;
        const next = setRadius(circle.getRadius());
        if (circle.getRadius() !== next) {
          applyingRef.current = true;
          circle.setRadius(next);
          applyingRef.current = false;
        }
      }),
      circle.addListener('center_changed', () => {
        if (applyingRef.current) return;
        const center = circle.getCenter();
        if (center) setPoint(center.lat(), center.lng());
      }),
      // Clique dentro do círculo também define o ponto, como no restante do mapa.
      circle.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) setPoint(event.latLng.lat(), event.latLng.lng());
      }),
    ];

    return () => {
      listeners.forEach((listener) => listener.remove());
      circle.setMap(null);
      circleRef.current = null;
    };
  }, [map, setPoint, setRadius]);

  // Campos → círculo e câmera. Compara antes de aplicar; um raio fora das regras
  // (ex.: 250 digitado) não mexe no círculo, e o erro fica no campo.
  useEffect(() => {
    const circle = circleRef.current;
    if (!map || !circle) return;

    if (pointLat === null || pointLng === null) {
      circle.setVisible(false);
      return;
    }

    const position = { lat: pointLat, lng: pointLng };

    applyingRef.current = true;
    try {
      const center = circle.getCenter();
      if (!center || roundCoordinate(center.lat()) !== pointLat || roundCoordinate(center.lng()) !== pointLng) {
        circle.setCenter(position);
      }
      if (isRadius(radius)) {
        if (circle.getRadius() !== radius) circle.setRadius(radius);
      } else if (!circle.getRadius()) {
        circle.setRadius(STORE_DEFAULT_DELIVERY_RADIUS_METERS);
      }
      if (!circle.getVisible()) circle.setVisible(true);
    } finally {
      applyingRef.current = false;
    }

    const bounds = map.getBounds();
    if (bounds && !bounds.contains(position)) map.panTo(position);
  }, [map, pointLat, pointLng, radius]);

  const canLocate = Boolean(token) && address.trim().length >= GEOCODE_MIN_LENGTH && !locating;

  const locateAddress = async () => {
    if (!token) return;

    setLocating(true);
    try {
      const result = await geocodeAddress(token, address);
      setPoint(result.latitude, result.longitude);
      map?.panTo({ lat: result.latitude, lng: result.longitude });
      map?.setZoom(STREET_ZOOM);
      setLocated(result);
    } catch (error) {
      // 404 (não encontrado) e 503 (indisponível): mensagem traduzida, sem mudar o ponto.
      toast.error(toErrorMessage(error));
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="outline" size="sm" onClick={locateAddress} disabled={!canLocate}>
          <LocateFixed className="size-4" strokeWidth={2.2} aria-hidden="true" />
          {locating ? 'Localizando…' : 'Localizar endereço no mapa'}
        </Button>
        {address.trim().length < GEOCODE_MIN_LENGTH ? (
          <span className="text-xs text-muted-ink">Preencha o endereço de referência para localizar.</span>
        ) : null}
      </div>

      {located ? (
        <div className="flex flex-col gap-1.5" role="status">
          <p className="text-xs text-ink-soft">Endereço encontrado: {located.formattedAddress}</p>
          {located.source === 'mock' ? (
            <p className="rounded-xl bg-warning-soft px-3.5 py-2 text-xs font-semibold text-warning">
              {STORE_MOCK_GEOCODING_WARNING}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-line bg-map">
        <GoogleMap
          mapId={GOOGLE_MAPS_MAP_ID}
          defaultCenter={initialCamera.center}
          defaultZoom={initialCamera.zoom}
          gestureHandling="cooperative"
          clickableIcons={false}
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={false}
          onClick={(event) => {
            const latLng = event.detail.latLng;
            if (latLng) setPoint(latLng.lat, latLng.lng);
          }}
          style={{ width: '100%', height: 360 }}
        >
          {pointLat !== null && pointLng !== null ? (
            <AdvancedMarker
              position={{ lat: pointLat, lng: pointLng }}
              draggable
              title="Ponto da loja"
              onDragEnd={(event) => {
                if (event.latLng) setPoint(event.latLng.lat(), event.latLng.lng());
              }}
            />
          ) : null}
        </GoogleMap>
      </div>

      <p className="text-xs text-muted-ink">
        Clique no mapa para marcar o ponto, arraste o marcador para ajustá-lo e puxe a borda do círculo para mudar o raio.
      </p>
    </div>
  );
}
