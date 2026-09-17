'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  APIProvider,
  Map as GoogleMap,
  Pin,
  useMap,
} from '@vis.gl/react-google-maps';
import { LocateFixed, MapPin, Store as StoreIcon, X } from 'lucide-react';
import { useWatch, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import {
  geocodeAddress,
  MOCK_GEOCODING_WARNING,
  reverseGeocode,
  type AddressSuggestion,
  type GeocodingResult,
} from '@/modules/stores/data/geocoding.api';
import { formatRadius } from '@/modules/stores/data/store-location.util';
import { badgeVariants } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { cn } from '@/shared/lib/class-name.util';
import {
  GOOGLE_MAPS_API_KEY,
  GOOGLE_MAPS_LOAD_ERROR_MESSAGE,
  GOOGLE_MAPS_MAP_ID,
  isGoogleMapsConfigured,
  roundCoordinate,
} from '@/shared/maps/google-maps.config';
import { useGoogleMapsLoadFailure } from '@/shared/maps/use-google-maps-load-failure.hook';
import { ApiError, toErrorMessage } from '@/shared/util/api-client.util';
import type { CustomerLocation } from '../data/customer.api';
import {
  addressSearchText,
  applyAddressSuggestion,
  CUSTOMER_ADDRESS_LOCATION_FIELDS,
  type CustomerAddressLocationField,
} from '../data/customer-address.util';
import type { CustomerFormData } from '../data/customer.schema';
import { onlyDigits } from '../data/customer.util';

/** Zoom de rua, para o ponto do cliente ou o endereço localizado. */
const STREET_ZOOM = 17;
/** Zoom de bairro, para o mapa centrado na loja. */
const NEIGHBORHOOD_ZOOM = 15;

/**
 * Ponto de exemplo sem loja selecionada: Avenida Paulista, 1578, o mesmo do
 * `MockGeocodingProvider` do backend.
 */
export const CUSTOMER_MAP_EXAMPLE_POINT: CustomerLocation = { latitude: -23.561414, longitude: -46.655881 };

export const CUSTOMER_MAP_HELP_TEXT =
  'Clique no mapa ou arraste o marcador até a porta de entrada. Sugerimos o endereço do ponto, e você decide se usa.';
export const CUSTOMER_MAP_STALE_MESSAGE = 'O endereço mudou depois de o ponto ser marcado. Confira o ponto no mapa.';
export const CUSTOMER_MAP_NOT_FOUND_MESSAGE = 'Não encontramos um endereço para este ponto. Preencha os campos abaixo.';

const BRAND_COLOR = '#FF6B00';
const BRAND_STRONG_COLOR = '#E85F00';
/** Cor da área de atendimento das lojas não selecionadas (`--muted-ink`). */
const STORE_AREA_COLOR = '#8A8177';

/** Texto do raio nos títulos dos marcadores e na lista: "atende até 1 km". */
function radiusLabel(meters: number): string {
  return `atende até ${formatRadius(meters)}`;
}

/** Loja ativa da vitrine (`StorefrontStoreDTO`), com o ponto e o raio de atendimento. */
export type CustomerMapStore = {
  id: string;
  name: string;
  slug: string;
  /** Endereço de referência da loja, exibido na lista; `null` quando a loja não tem. */
  address?: string | null;
  latitude: number;
  longitude: number;
  deliveryRadiusMeters: number;
};

/** Folga em pixels dos enquadramentos por `fitBounds`, para os círculos não colarem na borda. */
const MAP_FIT_PADDING = 48;

/**
 * Limites do círculo de atendimento de uma loja. Enquadrar o círculo (e não só
 * o centro) é o que faz a área aparecer: com zoom de bairro a tela fica dentro
 * de um raio de 2,5 km, e o círculo passa desapercebido. Só pode ser chamada
 * com a API do Maps carregada.
 */
function storeAreaBounds(store: CustomerMapStore): google.maps.LatLngBounds {
  const center = { lat: store.latitude, lng: store.longitude };
  const bounds = new google.maps.Circle({ center, radius: store.deliveryRadiusMeters }).getBounds();
  return bounds ?? new google.maps.LatLngBounds(center, center);
}

type SuggestionState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; suggestion: AddressSuggestion }
  | { status: 'not-found' };

/** Campos do endereço (sem complemento) no momento em que o ponto foi marcado, localizado ou a sugestão foi usada. */
type AddressAnchor = Record<CustomerAddressLocationField, string>;

const ADDRESS_FIELD_NAMES = CUSTOMER_ADDRESS_LOCATION_FIELDS.map((field) => `address.${field}` as const);

/** Valor comparável de um campo: sem espaços sobrando, CEP só com dígitos e UF em maiúsculas. */
function normalizeField(field: CustomerAddressLocationField, value: string | null | undefined): string {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (field === 'zipCode') return onlyDigits(text);
  if (field === 'state') return text.toUpperCase();
  return text;
}

function toAnchor(values: ReadonlyArray<string | null | undefined>): AddressAnchor {
  return Object.fromEntries(
    CUSTOMER_ADDRESS_LOCATION_FIELDS.map((field, index) => [field, normalizeField(field, values[index])]),
  ) as AddressAnchor;
}

function isPoint(value: unknown): value is CustomerLocation {
  if (typeof value !== 'object' || value === null) return false;
  const { latitude, longitude } = value as Partial<CustomerLocation>;
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
  );
}

type CustomerAddressMapProps = {
  /** Formulário de "Minha conta": o mapa edita `address.location`. */
  form: UseFormReturn<CustomerFormData>;
  /** Token da sessão, para a geocodificação. */
  token?: string;
  /** Todas as lojas ativas da vitrine (`GET /storefront/stores`); vazia enquanto nenhuma carregar. */
  stores: CustomerMapStore[];
  /** Slug da loja escolhida na vitrine; `null` enquanto as lojas carregam ou sem loja com o slug. */
  storeSlug: string | null;
  disabled?: boolean;
};

/**
 * Editor do ponto do endereço (`address.location`) em "Minha conta". O ponto
 * vive no formulário (`setValue` com `shouldDirty`), e este componente guarda
 * só o fluxo:
 * - clique no mapa, fim do arraste do marcador ou "Usar ponto de exemplo"
 *   gravam o ponto (6 casas) e pedem a sugestão de endereço
 *   (`GET /geocoding/reverse`), descartando respostas de pontos anteriores por
 *   um contador de requisição; a sugestão nunca muda os campos sozinha;
 * - "Localizar endereço no mapa" (logradouro e cidade preenchidos) move o
 *   marcador e a câmera para o endereço digitado, sem mudar os campos;
 * - o aviso de ponto desatualizado compara os campos (sem complemento) com a
 *   âncora gravada na última ação no mapa; um ponto vindo do cadastro começa
 *   sem âncora;
 * - "Remover ponto" grava `null`.
 *
 * Com a chave pública usa o Google Maps, que mostra **todas** as lojas ativas:
 * um marcador fixo e um círculo read-only com o raio de atendimento de cada
 * uma (a loja selecionada na vitrine em destaque), mais o marcador arrastável
 * do cliente. Clicar no marcador ou no círculo de uma loja marca o ponto ali,
 * como um clique no mapa. Sem a chave, ou com a chave recusada, usa o mapa
 * simulado. A lista das lojas com o raio fica abaixo do mapa nos dois casos,
 * porque o mapa simulado não desenha nada e as lojas distantes ficam fora do
 * enquadramento inicial. O raio é **informativo**: nada é bloqueado nem
 * alterado pela posição do ponto (Decisão 11).
 *
 * Montar só com as lojas já carregadas: a câmera inicial é calculada uma vez.
 */
export function CustomerAddressMap({ form, token, stores, storeSlug, disabled = false }: CustomerAddressMapProps) {
  const {
    control,
    getValues,
    setValue,
    clearErrors,
    formState: { errors },
  } = form;

  const { loadFailed, handleLoadError } = useGoogleMapsLoadFailure();
  const useGoogleMaps = isGoogleMapsConfigured && !loadFailed;

  /** Loja da vitrine: define a câmera inicial, o destaque no mapa e o ponto de exemplo. */
  const selectedStore = stores.find((item) => item.slug === storeSlug) ?? null;

  const location = useWatch({ control, name: 'address.location' });
  const addressValues = useWatch({ control, name: ADDRESS_FIELD_NAMES });
  const point = isPoint(location) ? location : null;

  const [suggestion, setSuggestion] = useState<SuggestionState>({ status: 'idle' });
  const [located, setLocated] = useState<GeocodingResult | null>(null);
  const [locating, setLocating] = useState(false);
  const [anchor, setAnchor] = useState<AddressAnchor | null>(null);

  // Número da última requisição de sugestão: respostas de números antigos são descartadas.
  const requestRef = useRef(0);
  const mapRef = useRef<google.maps.Map | null>(null);

  // Câmera inicial do mapa não controlado: o ponto do cliente (rua), a loja (bairro) ou a Paulista.
  const [initialCamera] = useState(() => {
    const saved = getValues('address.location');
    if (isPoint(saved)) return { center: { lat: saved.latitude, lng: saved.longitude }, zoom: STREET_ZOOM };
    // A câmera fica na loja selecionada, e não enquadrando todas: as lojas do
    // seed estão a ~360 km uma da outra (Decisão 11).
    const origin = selectedStore ?? CUSTOMER_MAP_EXAMPLE_POINT;
    return { center: { lat: origin.latitude, lng: origin.longitude }, zoom: NEIGHBORHOOD_ZOOM };
  });

  const currentAnchor = () => toAnchor(CUSTOMER_ADDRESS_LOCATION_FIELDS.map((field) => getValues(`address.${field}`)));

  const street = normalizeField('street', addressValues[CUSTOMER_ADDRESS_LOCATION_FIELDS.indexOf('street')]);
  const city = normalizeField('city', addressValues[CUSTOMER_ADDRESS_LOCATION_FIELDS.indexOf('city')]);
  const canLocate = Boolean(token) && street !== '' && city !== '' && !locating && !disabled;

  const watchedAnchor = toAnchor(addressValues);
  const stale =
    point !== null &&
    anchor !== null &&
    CUSTOMER_ADDRESS_LOCATION_FIELDS.some((field) => watchedAnchor[field] !== anchor[field]);

  /** Grava o ponto no formulário (6 casas, conta como alteração). */
  const writePoint = (latitude: number, longitude: number): CustomerLocation => {
    const next = { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) };
    setValue('address.location', next, { shouldDirty: true });
    clearErrors('root.location');
    return next;
  };

  /** Clique, fim do arraste ou ponto de exemplo: grava o ponto e pede a sugestão desse ponto. */
  const markPoint = async (latitude: number, longitude: number) => {
    const next = writePoint(latitude, longitude);
    const requestId = ++requestRef.current;

    setLocated(null);
    setAnchor(currentAnchor());

    if (!token) {
      setSuggestion({ status: 'idle' });
      return;
    }

    setSuggestion({ status: 'loading' });
    try {
      const result = await reverseGeocode(token, next);
      if (requestId === requestRef.current) setSuggestion({ status: 'found', suggestion: result });
    } catch (error) {
      if (requestId !== requestRef.current) return;
      if (error instanceof ApiError && error.status === 404) {
        setSuggestion({ status: 'not-found' });
        return;
      }
      // 503 (indisponível) e demais falhas: toaster, sem apagar o ponto.
      setSuggestion({ status: 'idle' });
      toast.error(toErrorMessage(error));
    }
  };

  /** "Usar este endereço": só os componentes não nulos, validando os campos. */
  const applySuggestion = (value: AddressSuggestion) => {
    const next = applyAddressSuggestion(getValues('address'), value);
    CUSTOMER_ADDRESS_LOCATION_FIELDS.forEach((field) => {
      if (value[field] !== null) {
        setValue(`address.${field}`, next[field], { shouldDirty: true, shouldValidate: true });
      }
    });
    setAnchor(currentAnchor());
    setSuggestion({ status: 'idle' });
  };

  /** "Localizar endereço no mapa": move marcador e câmera para o endereço digitado, sem mudar os campos. */
  const locateAddress = async () => {
    if (!token) return;

    setLocating(true);
    try {
      const result = await geocodeAddress(token, addressSearchText(getValues('address')));
      requestRef.current += 1;
      writePoint(result.latitude, result.longitude);
      mapRef.current?.panTo({ lat: result.latitude, lng: result.longitude });
      mapRef.current?.setZoom(STREET_ZOOM);
      setSuggestion({ status: 'idle' });
      setLocated(result);
      setAnchor(currentAnchor());
    } catch (error) {
      // 404 (não encontrado) e 503 (indisponível): mensagem traduzida, sem mudar o ponto.
      toast.error(toErrorMessage(error));
    } finally {
      setLocating(false);
    }
  };

  const removePoint = () => {
    requestRef.current += 1;
    setValue('address.location', null, { shouldDirty: true });
    clearErrors('root.location');
    setSuggestion({ status: 'idle' });
    setLocated(null);
    setAnchor(null);
  };

  const generalError =
    errors.root?.location?.message ?? (errors.address?.location as { message?: string } | undefined)?.message;

  /**
   * "Ver no mapa": enquadra a loja com todo o seu círculo de atendimento. Com
   * zoom de bairro a tela ficaria dentro do círculo (raio de 2,5 km no seed) e
   * ele não apareceria, que é justamente o que faz a loja passar despercebida.
   * Não toca no ponto do cliente.
   */
  const focusStore = (store: CustomerMapStore) => {
    const map = mapRef.current;
    if (!map) return;

    map.fitBounds(storeAreaBounds(store), MAP_FIT_PADDING);
  };

  /** "Ver todas as lojas": enquadra as lojas ativas e o ponto do cliente, quando houver. */
  const focusAllStores = () => {
    const map = mapRef.current;
    if (!map || stores.length === 0) return;
    if (stores.length === 1 && point === null) {
      focusStore(stores[0]);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    stores.forEach((store) => bounds.union(storeAreaBounds(store)));
    if (point !== null) bounds.extend({ lat: point.latitude, lng: point.longitude });
    map.fitBounds(bounds, MAP_FIT_PADDING);
  };

  const locateButton = (
    <Button type="button" variant="outline" size="sm" onClick={locateAddress} disabled={!canLocate} className="self-start">
      <LocateFixed className="size-4" strokeWidth={2.2} aria-hidden="true" />
      {locating ? 'Localizando…' : 'Localizar endereço no mapa'}
    </Button>
  );

  return (
    <div className="flex flex-col gap-3">
      {generalError ? <FormErrorMessage size="sm">{generalError}</FormErrorMessage> : null}

      {loadFailed ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-3.5 py-2.5 text-[13px] font-semibold text-warning">
          {GOOGLE_MAPS_LOAD_ERROR_MESSAGE}
        </p>
      ) : null}

      {stale ? (
        <div className="flex flex-col gap-2.5 rounded-xl bg-warning-soft px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] font-semibold text-warning">{CUSTOMER_MAP_STALE_MESSAGE}</p>
          {locateButton}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {locateButton}
          {street === '' || city === '' ? (
            <span className="text-xs text-muted-ink">Preencha logradouro e cidade para localizar.</span>
          ) : null}
        </div>
      )}

      {useGoogleMaps ? (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} language="pt-BR" region="BR" onError={handleLoadError}>
          <CustomerGoogleMap
            point={point}
            stores={stores}
            storeSlug={storeSlug}
            initialCamera={initialCamera}
            disabled={disabled}
            onMapChange={(map) => {
              mapRef.current = map;
            }}
            onPick={markPoint}
          />
        </APIProvider>
      ) : (
        <CustomerMockMap
          point={point}
          storeName={selectedStore?.name ?? null}
          disabled={disabled}
          onUseExample={() => {
            const origin = selectedStore ?? CUSTOMER_MAP_EXAMPLE_POINT;
            void markPoint(origin.latitude, origin.longitude);
          }}
        />
      )}

      <CustomerStoreList
        stores={stores}
        storeSlug={storeSlug}
        onFocusStore={useGoogleMaps ? focusStore : undefined}
        onFocusAll={useGoogleMaps ? focusAllStores : undefined}
      />

      <div role="status" aria-live="polite" className="empty:hidden">
        {point !== null && suggestion.status === 'loading' ? (
          <p className="rounded-2xl bg-surface px-4 py-3.5 text-[13.5px] text-muted-ink">Buscando endereço…</p>
        ) : null}

        {point !== null && suggestion.status === 'found' ? (
          <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-[13.5px] leading-[1.5] text-ink">
              <span className="font-bold">Endereço sugerido:</span> {suggestion.suggestion.formattedAddress}
            </p>
            {suggestion.suggestion.number === null ? (
              <p className="text-xs text-ink-soft">Confira o número depois de usar o endereço.</p>
            ) : null}
            {suggestion.suggestion.source === 'mock' ? (
              <p className="rounded-xl bg-warning-soft px-3.5 py-2 text-xs font-semibold text-warning">
                {MOCK_GEOCODING_WARNING}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => applySuggestion(suggestion.suggestion)} disabled={disabled}>
                Usar este endereço
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSuggestion({ status: 'idle' })}>
                Dispensar
              </Button>
            </div>
          </div>
        ) : null}

        {point !== null && suggestion.status === 'not-found' ? (
          <p className="rounded-2xl bg-surface px-4 py-3.5 text-[13.5px] text-ink-soft">{CUSTOMER_MAP_NOT_FOUND_MESSAGE}</p>
        ) : null}

        {point !== null && located ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-ink-soft">Endereço encontrado: {located.formattedAddress}</p>
            {located.source === 'mock' ? (
              <p className="rounded-xl bg-warning-soft px-3.5 py-2 text-xs font-semibold text-warning">
                {MOCK_GEOCODING_WARNING}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className="min-w-0 flex-1 basis-60 text-xs leading-[1.5] text-muted-ink">{CUSTOMER_MAP_HELP_TEXT}</p>
        {point !== null ? (
          <Button type="button" variant="ghost" size="sm" onClick={removePoint} disabled={disabled} className="text-danger">
            <X className="size-4" strokeWidth={2.2} aria-hidden="true" />
            Remover ponto
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type CustomerGoogleMapProps = {
  point: CustomerLocation | null;
  /** Todas as lojas ativas: marcador fixo e círculo de atendimento de cada uma. */
  stores: CustomerMapStore[];
  /** Slug da loja da vitrine, destacada entre as demais. */
  storeSlug: string | null;
  initialCamera: { center: { lat: number; lng: number }; zoom: number };
  disabled: boolean;
  /** Instância do mapa (ou `null` ao desmontar), para "Localizar" mover a câmera. */
  onMapChange: (map: google.maps.Map | null) => void;
  /** Clique no mapa, em uma loja (marcador ou círculo) ou fim do arraste do marcador do cliente. */
  onPick: (latitude: number, longitude: number) => void;
};

/**
 * Google Maps não controlado, com o marcador fixo e o círculo de atendimento de
 * cada loja ativa (a da vitrine em destaque) e o marcador arrastável do cliente.
 */
function CustomerGoogleMap({
  point,
  stores,
  storeSlug,
  initialCamera,
  disabled,
  onMapChange,
  onPick,
}: CustomerGoogleMapProps) {
  const map = useMap();
  const pointLat = point?.latitude ?? null;
  const pointLng = point?.longitude ?? null;

  // Listeners imperativos dos círculos leem o estado atual por ref: os círculos
  // não são recriados quando `onPick` ou `disabled` mudam.
  const pickRef = useRef(onPick);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    pickRef.current = onPick;
    disabledRef.current = disabled;
  }, [onPick, disabled]);

  useEffect(() => {
    onMapChange(map);
    return () => onMapChange(null);
  }, [map, onMapChange]);

  // Enquadramento inicial sem ponto do cliente: a loja da vitrine com todo o
  // seu círculo de atendimento, para a área aparecer já na abertura (o
  // `defaultZoom` de bairro deixaria a tela dentro do círculo).
  const framedRef = useRef(false);
  useEffect(() => {
    if (!map || framedRef.current) return;
    if (pointLat !== null || pointLng !== null) {
      framedRef.current = true;
      return;
    }

    const selected = stores.find((store) => store.slug === storeSlug);
    if (!selected) return;

    map.fitBounds(storeAreaBounds(selected), MAP_FIT_PADDING);
    framedRef.current = true;
  }, [map, pointLat, pointLng, stores, storeSlug]);

  // Ponto fora da área visível (ex.: descartar alterações): leva a câmera até ele.
  useEffect(() => {
    if (!map || pointLat === null || pointLng === null) return;
    const position = { lat: pointLat, lng: pointLng };
    const bounds = map.getBounds();
    if (bounds && !bounds.contains(position)) map.panTo(position);
  }, [map, pointLat, pointLng]);

  const areas = useMemo(
    () =>
      stores.map((store) => ({
        id: store.id,
        center: { lat: store.latitude, lng: store.longitude },
        radius: store.deliveryRadiusMeters,
        selected: store.slug === storeSlug,
      })),
    [stores, storeSlug],
  );

  // Círculos read-only do raio de atendimento (a biblioteca não tem componente
  // pronto): um por loja, recriados quando a lista muda e removidos no unmount.
  useEffect(() => {
    if (!map) return;

    const circles = areas.map(
      (area) =>
        new google.maps.Circle({
          map,
          center: area.center,
          radius: area.radius,
          editable: false,
          draggable: false,
          clickable: true,
          fillColor: area.selected ? BRAND_COLOR : STORE_AREA_COLOR,
          fillOpacity: area.selected ? 0.12 : 0.09,
          strokeColor: area.selected ? BRAND_COLOR : STORE_AREA_COLOR,
          strokeOpacity: area.selected ? 0.85 : 0.7,
          strokeWeight: area.selected ? 2 : 1.5,
          zIndex: area.selected ? 2 : 1,
        }),
    );

    // Sem isto o círculo viraria área morta sobre o mapa: dentro dele o clique
    // marca o ponto do cliente, como em qualquer outro lugar do mapa.
    const listeners = circles.map((circle) =>
      circle.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng && !disabledRef.current) pickRef.current(event.latLng.lat(), event.latLng.lng());
      }),
    );

    return () => {
      listeners.forEach((listener) => listener.remove());
      circles.forEach((circle) => circle.setMap(null));
    };
  }, [map, areas]);

  return (
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
          if (latLng && !disabled) onPick(latLng.lat, latLng.lng);
        }}
        style={{ width: '100%', height: 340 }}
      >
        {stores.map((store) => {
          const selected = store.slug === storeSlug;
          return (
            <AdvancedMarker
              key={store.id}
              position={{ lat: store.latitude, lng: store.longitude }}
              title={`${store.name} · ${radiusLabel(store.deliveryRadiusMeters)}`}
              clickable={!disabled}
              anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
              zIndex={selected ? 2 : 1}
              onClick={() => onPick(store.latitude, store.longitude)}
            >
              <span
                className={cn(
                  'flex items-center justify-center rounded-full border-2 border-white text-white',
                  selected ? 'size-9 bg-dark shadow-float' : 'size-7 bg-muted-ink shadow-card',
                )}
              >
                <StoreIcon className={selected ? 'size-4' : 'size-3.5'} strokeWidth={2.2} aria-hidden="true" />
              </span>
            </AdvancedMarker>
          );
        })}

        {pointLat !== null && pointLng !== null ? (
          <AdvancedMarker
            position={{ lat: pointLat, lng: pointLng }}
            title="Seu ponto de entrega"
            draggable={!disabled}
            zIndex={3}
            onDragEnd={(event) => {
              if (event.latLng) onPick(event.latLng.lat(), event.latLng.lng());
            }}
          >
            <Pin background={BRAND_COLOR} borderColor={BRAND_STRONG_COLOR} glyphColor="#FFFFFF" />
          </AdvancedMarker>
        ) : null}
      </GoogleMap>
    </div>
  );
}

type CustomerStoreListProps = {
  stores: CustomerMapStore[];
  storeSlug: string | null;
  /** "Ver no mapa" de cada loja; ausente no mapa simulado, que não tem câmera. */
  onFocusStore?: (store: CustomerMapStore) => void;
  /** "Ver todas as lojas"; ausente no mapa simulado. */
  onFocusAll?: () => void;
};

/**
 * Lista das lojas ativas com endereço e raio de atendimento, abaixo do mapa.
 * Ela resolve o que o mapa não resolve: a câmera abre na região da loja da
 * vitrine (as do seed estão a ~360 km uma da outra), então sem "Ver no mapa" e
 * "Ver todas as lojas" o usuário não chega às outras lojas nem descobre que
 * existem. No mapa simulado, que não desenha marcadores nem círculos, a lista é
 * a única informação. O texto diz que o raio é a área de atendimento da loja e
 * que nada depende dele nesta entrega.
 */
function CustomerStoreList({ stores, storeSlug, onFocusStore, onFocusAll }: CustomerStoreListProps) {
  if (stores.length === 0) return null;

  return (
    <section aria-labelledby="account-stores-title" className="flex flex-col gap-2 rounded-2xl bg-surface px-4 py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 id="account-stores-title" className="text-xs font-bold text-ink-soft">
          Área de atendimento das lojas
        </h3>
        {onFocusAll && stores.length > 1 ? (
          <Button type="button" variant="ghost" size="sm" onClick={onFocusAll} className="h-auto px-1.5 py-0.5">
            Ver todas as lojas
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {stores.map((store) => {
          const selected = store.slug === storeSlug;
          return (
            <li key={store.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] leading-[1.5]">
              <StoreIcon
                className={cn('size-3.5 shrink-0 self-center', selected ? 'text-ink' : 'text-muted-ink')}
                strokeWidth={2.4}
                aria-hidden="true"
              />
              <span className={cn('font-bold', selected ? 'text-ink' : 'text-ink-soft')}>{store.name}</span>
              <span className="text-muted-ink">{radiusLabel(store.deliveryRadiusMeters)}</span>
              {selected ? (
                <span className={cn(badgeVariants({ variant: 'outline' }), 'shrink-0 self-center')}>
                  Loja da vitrine
                </span>
              ) : null}
              {onFocusStore ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onFocusStore(store)}
                  className="h-auto self-center px-1.5 py-0.5"
                >
                  <MapPin className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
                  Ver no mapa
                </Button>
              ) : null}
              {store.address ? (
                <span className="min-w-0 basis-full text-xs text-muted-ink sm:pl-[1.375rem]">{store.address}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-xs leading-[1.5] text-muted-ink">
        O raio mostra até onde cada loja entrega hoje. É só informação: você pode marcar e salvar o ponto onde quiser.
      </p>
    </section>
  );
}

type CustomerMockMapProps = {
  point: CustomerLocation | null;
  storeName: string | null;
  disabled: boolean;
  onUseExample: () => void;
};

/**
 * Mapa simulado, sem nenhuma chamada ao Google: a ilustração do cadastro de
 * loja com o selo "Mapa simulado" e o botão "Usar ponto de exemplo", que marca
 * o ponto da loja selecionada (ou o da Avenida Paulista) e segue o fluxo de sugestão.
 */
function CustomerMockMap({ point, storeName, disabled, onUseExample }: CustomerMockMapProps) {
  return (
    <figure className="flex flex-col gap-2.5">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-map">
        <Image src="/images/store-map-mock.svg" alt="" width={640} height={360} unoptimized className="block h-auto w-full" />
        <span className={cn(badgeVariants({ variant: 'outline' }), 'absolute left-3 top-3 shadow-float')}>Mapa simulado</span>
        {point ? (
          <span
            className={cn(
              badgeVariants({ variant: 'outline' }),
              'absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] shadow-float tabular-nums',
            )}
          >
            <MapPin className="size-3.5 text-brand" strokeWidth={2.4} aria-hidden="true" />
            <span className="truncate">
              Ponto marcado: {point.latitude}, {point.longitude}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="outline" size="sm" onClick={onUseExample} disabled={disabled}>
          <MapPin className="size-4" strokeWidth={2.2} aria-hidden="true" />
          Usar ponto de exemplo
        </Button>
      </div>

      <figcaption className="text-xs leading-[1.5] text-muted-ink">
        Google Maps indisponível: configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. &quot;Usar ponto de exemplo&quot; marca o
        ponto {storeName ? `da ${storeName}` : 'da Avenida Paulista, 1578 – São Paulo/SP'}.
      </figcaption>
    </figure>
  );
}
