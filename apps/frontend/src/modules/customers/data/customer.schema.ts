import { Cpf, Flag, Phone, Text } from '@mentoria-360/shared';
import { v } from '@/shared/components/form/validator';
import type { ValueObjectClass, VOResult } from '@/shared/components/form/validator/types';
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

/**
 * Validação dos dados de cliente com as mesmas regras da API, usada pela
 * edição administrativa e pelos dados de entrega do checkout:
 * - `cpf` e `phone` pelos próprios `Cpf` e `Phone` do shared (`tryCreate`), a
 *   mesma fonte de verdade da API (aceitam a máscara e devolvem só os dígitos);
 * - `address`: CEP com 8 dígitos, textos nos limites do domínio, complemento
 *   opcional e UF dentre `BRAZILIAN_STATES`;
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
  }),
  isActive: { vo: Flag, optional: true },
});

export type CustomerFormData = v.infer<typeof customerSchema>;
