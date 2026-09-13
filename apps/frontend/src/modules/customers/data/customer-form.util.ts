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

/** Endereço inicial de um formulário sem cadastro (ex.: bairro da vitrine, Fortaleza e CE). */
export type CustomerAddressDefaults = Partial<Record<keyof CustomerFormData['address'], string>>;

/** Formulário vazio (sem `isActive`, que só o formulário administrativo usa). */
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

/** Cliente da API → valores do formulário, com CPF, telefone e CEP já mascarados (sem `isActive`). */
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
    },
    isActive: undefined,
  };
}

/**
 * Valores validados → corpo do `PUT`: CPF, telefone e CEP sem máscara,
 * complemento vazio como `null` e `isActive` só quando o formulário o tem.
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
    },
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
  };
}

/**
 * Trata a falha ao salvar um cliente: os códigos de `CUSTOMER_FIELD_BY_CODE`
 * viram erro no campo (foco no primeiro, uma mensagem por campo) e os demais
 * códigos, ou qualquer outro erro, viram toaster.
 */
export function reportCustomerSaveError(error: unknown, setError: UseFormSetError<CustomerFormData>): void {
  if (error instanceof ApiError) {
    const fieldCodes = error.codes.filter((code) => CUSTOMER_FIELD_BY_CODE[code]);

    if (fieldCodes.length > 0) {
      const reported = new Set<CustomerFormField>();

      fieldCodes.forEach((code) => {
        const field = CUSTOMER_FIELD_BY_CODE[code];
        if (reported.has(field)) return;

        setError(field, { type: 'server', message: getMessage(code) }, { shouldFocus: reported.size === 0 });
        reported.add(field);
      });

      const otherMessages = new Set(
        error.codes.filter((code) => !CUSTOMER_FIELD_BY_CODE[code]).map((code) => getMessage(code)),
      );
      if (otherMessages.size > 0) toast.error([...otherMessages].join(' '));
      return;
    }
  }

  toast.error(toErrorMessage(error));
}
