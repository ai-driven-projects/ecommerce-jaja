import { Alias, Flag, Name, Phone, Text } from '@mentoria-360/shared';
import { v } from '@/shared/components/form/validator';
import type { ValueObjectClass, VOResult } from '@/shared/components/form/validator/types';
import { roundCoordinate } from '@/shared/maps/google-maps.config';
import { STORE_MAX_DELIVERY_RADIUS_METERS, STORE_MIN_DELIVERY_RADIUS_METERS } from './store-location.util';

/** Endereço de referência: texto livre opcional, até 200 caracteres (como na entidade `Store`). */
export const STORE_ADDRESS_MAX_LENGTH = 200;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function ok(value: number): VOResult<number> {
  return { isOk: true, isFailure: false, instance: { value } };
}

function fail(code: string): VOResult<number> {
  return { isOk: false, isFailure: true, errors: [code] };
}

/** Latitude como a do `GeoPoint` do domínio: número finito de −90 a 90, arredondado para 6 casas. */
const LatitudeValue: ValueObjectClass<number> = {
  tryCreate(value: number): VOResult<number> {
    return isFiniteNumber(value) && value >= -90 && value <= 90
      ? ok(roundCoordinate(value))
      : fail('GEO_POINT_LATITUDE_INVALID');
  },
};

/** Longitude como a do `GeoPoint` do domínio: número finito de −180 a 180, arredondado para 6 casas. */
const LongitudeValue: ValueObjectClass<number> = {
  tryCreate(value: number): VOResult<number> {
    return isFiniteNumber(value) && value >= -180 && value <= 180
      ? ok(roundCoordinate(value))
      : fail('GEO_POINT_LONGITUDE_INVALID');
  },
};

/** Raio como o `DeliveryRadius` do domínio: inteiro de 300 a 10.000 metros. */
const DeliveryRadiusValue: ValueObjectClass<number> = {
  tryCreate(value: number): VOResult<number> {
    return isFiniteNumber(value) &&
      Number.isInteger(value) &&
      value >= STORE_MIN_DELIVERY_RADIUS_METERS &&
      value <= STORE_MAX_DELIVERY_RADIUS_METERS
      ? ok(value)
      : fail('DELIVERY_RADIUS_INVALID');
  },
};

/**
 * Validação do formulário de loja com as mesmas regras da API: nome de 2 a 100
 * caracteres, slug no padrão `Alias`, telefone opcional pelo `Phone` do shared
 * (aceita a máscara e devolve só os dígitos), endereço de referência opcional
 * até 200 caracteres, latitude (−90 a 90) e longitude (−180 a 180)
 * obrigatórias, raio inteiro de 300 a 10.000 m e status ativo booleano.
 */
export const storeSchema = v.defineObject({
  name: Name,
  slug: Alias,
  phone: { vo: Phone, optional: true },
  address: { vo: Text, optional: true, config: { maxLength: STORE_ADDRESS_MAX_LENGTH } },
  latitude: LatitudeValue,
  longitude: LongitudeValue,
  deliveryRadiusMeters: DeliveryRadiusValue,
  isActive: Flag,
});

export type StoreFormData = v.infer<typeof storeSchema>;
