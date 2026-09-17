import { Cpf, Flag, Phone, Text } from '@mentoria-360/shared';
import { v } from '@/shared/components/form/validator';
import type { Resolver } from 'react-hook-form';
import type { ValueObjectClass, VOResult } from '@/shared/components/form/validator/types';
import { roundCoordinate } from '@/shared/maps/google-maps.config';
import type { CustomerLocation } from './customer.api';
import { BRAZILIAN_STATES } from './customer.util';

// Limites do endereço, iguais aos de `CustomerAddress` no domínio (valem após o trim).
export const CUSTOMER_STREET_MIN_LENGTH = 2;
export const CUSTOMER_STREET_MAX_LENGTH = 120;
export const CUSTOMER_NUMBER_MIN_LENGTH = 1;
export const CUSTOMER_NUMBER_MAX_LENGTH = 10;
export const CUSTOMER_COMPLEMENT_MAX_LENGTH = 80;
export const CUSTOMER_NEIGHBORHOOD_MIN_LENGTH = 2;
export const CUSTOMER_NEIGHBORHOOD_MAX_LENGTH = 60;
export const CUSTOMER_CITY_MIN_LENGTH = 2;
export const CUSTOMER_CITY_MAX_LENGTH = 60;

// Limites do ponto do endereço, iguais aos de `CustomerLocation` no domínio.
export const CUSTOMER_LOCATION_MAX_LATITUDE = 90;
export const CUSTOMER_LOCATION_MAX_LONGITUDE = 180;

const ZIP_CODE_PATTERN = /^\d{5}-?\d{3}$/;
const STATE_CODES: ReadonlySet<string> = new Set(BRAZILIAN_STATES.map((state) => state.code));

function ok(value: string): VOResult<string> {
  return { isOk: true, isFailure: false, instance: { value } };
}

function fail(code: string): VOResult<string> {
  return { isOk: false, isFailure: true, errors: [code] };
}

/**
 * CEP como o `ZipCode` do domínio: `60150-160` ou `60150160` (com trim), guardado
 * com os 8 dígitos; qualquer outro formato falha com `CUSTOMER_ZIP_CODE_INVALID`.
 */
const ZipCodeValue: ValueObjectClass<string> = {
  tryCreate(value: string): VOResult<string> {
    const text = typeof value === 'string' ? value.trim() : '';
    return ZIP_CODE_PATTERN.test(text) ? ok(text.replace(/\D/g, '')) : fail('CUSTOMER_ZIP_CODE_INVALID');
  },
};

/**
 * UF como o `StateCode` do domínio: sigla de `BRAZILIAN_STATES`, aceita
 * minúsculas e guarda em maiúsculas; fora da lista falha com `CUSTOMER_STATE_INVALID`.
 */
const StateCodeValue: ValueObjectClass<string> = {
  tryCreate(value: string): VOResult<string> {
    const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return STATE_CODES.has(code) ? ok(code) : fail('CUSTOMER_STATE_INVALID');
  },
};

function isCoordinate(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -max && value <= max;
}

/**
 * Ponto como o `CustomerLocation` do domínio: `latitude` de −90 a 90 e
 * `longitude` de −180 a 180, números finitos, guardados com 6 casas; qualquer
 * outro valor falha com `CUSTOMER_LOCATION_INVALID`.
 */
const CustomerLocationValue: ValueObjectClass<CustomerLocation | null> = {
  tryCreate(value: CustomerLocation | null): VOResult<CustomerLocation> {
    const candidate = (typeof value === 'object' && value !== null ? value : {}) as Partial<CustomerLocation>;
    const { latitude, longitude } = candidate;

    if (!isCoordinate(latitude, CUSTOMER_LOCATION_MAX_LATITUDE) || !isCoordinate(longitude, CUSTOMER_LOCATION_MAX_LONGITUDE)) {
      return { isOk: false, isFailure: true, errors: ['CUSTOMER_LOCATION_INVALID'] };
    }

    return {
      isOk: true,
      isFailure: false,
      instance: { value: { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) } },
    };
  },
};

/**
 * Validação dos dados de cliente com as mesmas regras da API, usada pela
 * edição administrativa e pelos dados de entrega do checkout:
 * - `cpf` e `phone` pelos próprios `Cpf` e `Phone` do shared (`tryCreate`), a
 *   mesma fonte de verdade da API (aceitam a máscara e devolvem só os dígitos);
 * - `address`: CEP com 8 dígitos, textos nos limites do domínio, complemento
 *   opcional, UF dentre `BRAZILIAN_STATES` e o ponto (`location`) opcional:
 *   ausente (formulário sem ponto), `null` (sem ponto ou removido) ou
 *   `{ latitude, longitude }` nos limites do domínio;
 * - `isActive` opcional: só o formulário administrativo o envia.
 */
export const customerSchema = v.defineObject({
  cpf: Cpf,
  phone: Phone,
  address: v.defineObject({
    zipCode: ZipCodeValue,
    street: {
      vo: Text,
      config: { minLength: CUSTOMER_STREET_MIN_LENGTH, maxLength: CUSTOMER_STREET_MAX_LENGTH },
    },
    number: {
      vo: Text,
      config: { minLength: CUSTOMER_NUMBER_MIN_LENGTH, maxLength: CUSTOMER_NUMBER_MAX_LENGTH },
    },
    complement: { vo: Text, optional: true, config: { maxLength: CUSTOMER_COMPLEMENT_MAX_LENGTH } },
    neighborhood: {
      vo: Text,
      config: { minLength: CUSTOMER_NEIGHBORHOOD_MIN_LENGTH, maxLength: CUSTOMER_NEIGHBORHOOD_MAX_LENGTH },
    },
    city: {
      vo: Text,
      config: { minLength: CUSTOMER_CITY_MIN_LENGTH, maxLength: CUSTOMER_CITY_MAX_LENGTH },
    },
    state: StateCodeValue,
    location: { vo: CustomerLocationValue, optional: true },
  }),
  isActive: { vo: Flag, optional: true },
});

type CustomerSchemaData = v.infer<typeof customerSchema>;

/**
 * Valores do formulário de cliente. `address.location` é opcional também no
 * tipo: ausente quando o formulário nasce sem cadastro (o ponto não vai no `PUT`).
 */
export type CustomerFormData = Omit<CustomerSchemaData, 'address'> & {
  address: Omit<CustomerSchemaData['address'], 'location'> & { location?: CustomerLocation | null };
};

const customerSchemaResolver = v.resolver(customerSchema) as unknown as Resolver<CustomerFormData>;

/**
 * Resolver dos formulários de cliente: o `v.resolver(customerSchema)` mais a
 * diferença entre ponto ausente e `null`. O validador descarta campos opcionais
 * vazios, então um `address.location` `null` (ponto removido ou cadastro sem
 * ponto) sumiria dos valores validados e a API manteria o ponto antigo. Aqui o
 * `null` volta aos valores, e `toCustomerInput` o envia como está.
 */
export const customerResolver: Resolver<CustomerFormData> = async (values, context, options) => {
  const result = await customerSchemaResolver(values, context, options);
  if (Object.keys(result.errors).length > 0 || values.address?.location !== null) return result;

  const validated = result.values as CustomerFormData;
  return { values: { ...validated, address: { ...validated.address, location: null } }, errors: {} };
};
