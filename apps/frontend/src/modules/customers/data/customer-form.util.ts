import type { UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { getMessage } from '@/shared/i18n';
import { ApiError, toErrorMessage } from '@/shared/util/api-client.util';
import type { Customer, CustomerInput } from './customer.api';
import type { CustomerFormData } from './customer.schema';
import { formatCpf, formatPhone, formatZipCode, onlyDigits } from './customer.util';

/**
 * Apoio comum aos dois formulários de cliente (edição administrativa e dados
 * de entrega do checkout): valores iniciais, montagem do corpo do `PUT` e o
 * mapa de erros da API para os campos.
 */

/** Campos do formulário que recebem erros da API. */
export type CustomerFormField = 'cpf' | 'phone' | 'address.zipCode' | 'address.state';

/** Rejeições da API e o campo do formulário que cada uma aponta. */
export const CUSTOMER_FIELD_BY_CODE: Readonly<Record<string, CustomerFormField>> = {
  CUSTOMER_CPF_ALREADY_EXISTS: 'cpf',
  CPF_INVALID_CHECK_DIGIT: 'cpf',
  CPF_INVALID_FORMAT: 'cpf',
  CPF_INVALID_LENGTH: 'cpf',
  CPF_REPEATED_SEQUENCE: 'cpf',
  PHONE_INVALID_FORMAT: 'phone',
  PHONE_INVALID_LENGTH: 'phone',
  CUSTOMER_ZIP_CODE_INVALID: 'address.zipCode',
  CUSTOMER_STATE_INVALID: 'address.state',
};

/** Endereço inicial de um formulário sem cadastro (ex.: a cidade e a UF da loja escolhida na vitrine). */
export type CustomerAddressDefaults = Partial<Record<Exclude<keyof CustomerFormData['address'], 'location'>, string>>;

/**
 * Formulário vazio (sem `isActive`, que só o formulário administrativo usa) e
 * sem ponto: `location` ausente não vai no `PUT`, e a API cria o cadastro sem ponto.
 */
export function emptyCustomerFormValues(defaults: CustomerAddressDefaults = {}): CustomerFormData {
  return {
    cpf: '',
    phone: '',
    address: {
      zipCode: defaults.zipCode ?? '',
      street: defaults.street ?? '',
      number: defaults.number ?? '',
      complement: defaults.complement ?? '',
      neighborhood: defaults.neighborhood ?? '',
      city: defaults.city ?? '',
      state: defaults.state ?? '',
    },
    isActive: undefined,
  };
}

/**
 * Cliente da API → valores do formulário, com CPF, telefone e CEP já mascarados
 * (sem `isActive`). O ponto do cadastro (`null` quando não há) vai junto, para
 * as telas sem mapa (checkout e administração) o devolverem sem editá-lo.
 */
export function toCustomerFormValues(customer: Customer): CustomerFormData {
  return {
    cpf: formatCpf(customer.cpf),
    phone: formatPhone(customer.phone),
    address: {
      zipCode: formatZipCode(customer.address.zipCode),
      street: customer.address.street,
      number: customer.address.number,
      complement: customer.address.complement ?? '',
      neighborhood: customer.address.neighborhood,
      city: customer.address.city,
      state: customer.address.state,
      location: customer.address.location,
    },
    isActive: undefined,
  };
}

/**
 * Valores validados → corpo do `PUT`: CPF, telefone e CEP sem máscara,
 * complemento vazio como `null` e `isActive` só quando o formulário o tem.
 * `address.location` vai como está no formulário (regra de preservação da
 * API): ausente não é enviado e mantém o ponto atual, `null` remove e um objeto
 * grava. Nunca trocar `undefined` por `null` aqui.
 */
export function toCustomerInput(data: CustomerFormData): CustomerInput {
  return {
    cpf: onlyDigits(data.cpf),
    phone: onlyDigits(data.phone),
    address: {
      zipCode: onlyDigits(data.address.zipCode),
      street: data.address.street,
      number: data.address.number,
      complement: data.address.complement?.trim() || null,
      neighborhood: data.address.neighborhood,
      city: data.address.city,
      state: data.address.state,
      ...(data.address.location !== undefined ? { location: data.address.location } : {}),
    },
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
  };
}

/** Ponto do endereço inválido: não é de nenhum campo, vira erro geral acima do mapa. */
export const CUSTOMER_LOCATION_INVALID = 'CUSTOMER_LOCATION_INVALID';

/** Erro geral do ponto no formulário (`formState.errors.root.location`). */
export const CUSTOMER_LOCATION_ERROR_FIELD = 'root.location';

export type ReportCustomerSaveErrorOptions = {
  /**
   * Formulário com mapa ("Minha conta"): `CUSTOMER_LOCATION_INVALID` vira o
   * erro geral `root.location` em vez de toaster.
   */
  locationError?: boolean;
};

/**
 * Trata a falha ao salvar um cliente: os códigos de `CUSTOMER_FIELD_BY_CODE`
 * viram erro no campo (foco no primeiro, uma mensagem por campo), com
 * `locationError` o `CUSTOMER_LOCATION_INVALID` vira o erro geral do ponto, e
 * os demais códigos, ou qualquer outro erro, viram toaster.
 */
export function reportCustomerSaveError(
  error: unknown,
  setError: UseFormSetError<CustomerFormData>,
  { locationError = false }: ReportCustomerSaveErrorOptions = {},
): void {
  if (error instanceof ApiError) {
    const fieldCodes = error.codes.filter((code) => CUSTOMER_FIELD_BY_CODE[code]);
    const locationReported = locationError && error.codes.includes(CUSTOMER_LOCATION_INVALID);

    if (locationReported) {
      setError(CUSTOMER_LOCATION_ERROR_FIELD, { type: 'server', message: getMessage(CUSTOMER_LOCATION_INVALID) });
    }

    if (fieldCodes.length > 0 || locationReported) {
      const reported = new Set<CustomerFormField>();

      fieldCodes.forEach((code) => {
        const field = CUSTOMER_FIELD_BY_CODE[code];
        if (reported.has(field)) return;

        setError(field, { type: 'server', message: getMessage(code) }, { shouldFocus: reported.size === 0 });
        reported.add(field);
      });

      const otherMessages = new Set(
        error.codes
          .filter((code) => !CUSTOMER_FIELD_BY_CODE[code] && !(locationReported && code === CUSTOMER_LOCATION_INVALID))
          .map((code) => getMessage(code)),
      );
      if (otherMessages.size > 0) toast.error([...otherMessages].join(' '));
      return;
    }
  }

  toast.error(toErrorMessage(error));
}
