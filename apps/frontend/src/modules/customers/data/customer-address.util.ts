import type { CustomerFormData } from './customer.schema';
import { formatZipCode } from './customer.util';

/**
 * Apoio do endereço de "Minha conta" com o mapa: aplicar a sugestão de
 * endereço de um ponto e montar o texto para localizar o endereço digitado.
 */

/** Endereço do formulário de cliente (com o ponto). */
export type CustomerAddressFormValues = CustomerFormData['address'];

/** Componentes do endereço sugeridos para um ponto (`AddressSuggestion` de `modules/stores/data`). */
export type AddressSuggestionFields = {
  zipCode: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
};

/**
 * Campos de texto do endereço que descrevem o local (sem complemento): a
 * sugestão os preenche e mudá-los à mão desatualiza o ponto marcado.
 */
export const CUSTOMER_ADDRESS_LOCATION_FIELDS = ['zipCode', 'street', 'number', 'neighborhood', 'city', 'state'] as const;

export type CustomerAddressLocationField = (typeof CUSTOMER_ADDRESS_LOCATION_FIELDS)[number];

/**
 * Endereço com os componentes **não nulos** da sugestão (CEP formatado como
 * `01310-200`); complemento, ponto e os campos cujos componentes vieram `null`
 * ficam como estavam.
 */
export function applyAddressSuggestion(
  current: CustomerAddressFormValues,
  suggestion: AddressSuggestionFields,
): CustomerAddressFormValues {
  return {
    ...current,
    zipCode: suggestion.zipCode !== null ? formatZipCode(suggestion.zipCode) : current.zipCode,
    street: suggestion.street ?? current.street,
    number: suggestion.number ?? current.number,
    neighborhood: suggestion.neighborhood ?? current.neighborhood,
    city: suggestion.city ?? current.city,
    state: suggestion.state ?? current.state,
  };
}

/**
 * Texto para localizar o endereço digitado (`GET /geocoding`): logradouro e
 * número, bairro, cidade/UF e CEP, sem complemento e sem partes vazias
 * (`"Avenida Paulista, 1578, Bela Vista, São Paulo/SP, 01310-200"`).
 */
export function addressSearchText(address: Partial<Pick<CustomerAddressFormValues, CustomerAddressLocationField>>): string {
  const text = (value: string | null | undefined) => value?.trim() ?? '';
  const city = [text(address.city), text(address.state).toUpperCase()].filter(Boolean).join('/');
  const zipCode = text(address.zipCode) ? formatZipCode(address.zipCode) : '';

  return [text(address.street), text(address.number), text(address.neighborhood), city, zipCode]
    .filter(Boolean)
    .join(', ');
}
