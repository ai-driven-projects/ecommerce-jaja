import { onlyDigits } from '@/shared/util/phone.util';
import type { CustomerAddress } from './customer.api';

/** Unidades federativas do Brasil (sigla e nome), em ordem alfabética de sigla. */
export const BRAZILIAN_STATES: ReadonlyArray<{ code: string; name: string }> = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'PR', name: 'Paraná' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'TO', name: 'Tocantins' },
];

// `onlyDigits` e `formatPhone` vivem em `@/shared/util/phone.util` (usados também por lojas).
export { formatPhone, onlyDigits } from '@/shared/util/phone.util';

/**
 * CPF no formato `000.000.000-00`. Aceita texto parcial (máscara durante a
 * digitação) e ignora o que passar de 11 dígitos.
 */
export function formatCpf(value: string | null | undefined): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** CEP no formato `60150-160`. Aceita texto parcial e ignora o que passar de 8 dígitos. */
export function formatZipCode(value: string | null | undefined): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/**
 * Endereço em uma linha: `"Rua, número · complemento · bairro · cidade/UF · CEP"`,
 * sem o complemento quando ele é `null` ou vazio.
 */
export function formatCustomerAddress(address: CustomerAddress): string {
  return [
    `${address.street}, ${address.number}`,
    address.complement?.trim() || null,
    address.neighborhood,
    `${address.city}/${address.state}`,
    formatZipCode(address.zipCode),
  ]
    .filter(Boolean)
    .join(' · ');
}
