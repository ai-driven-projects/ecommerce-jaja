import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CustomerErrors, SaveCustomerInput } from '@jaja/customers';

// HTTP helpers shared by `CustomerController` (administration) and
// `MyCustomerController` (the user): both send the same body to `SaveCustomer`
// and translate its failures the same way.

export type SaveCustomerBody = {
  cpf: string;
  phone: string;
  address: {
    zipCode: string;
    street: string;
    number: string;
    complement?: string | null;
    neighborhood: string;
    city: string;
    state: string;
  };
  isActive?: boolean;
};

export type SaveCustomerFields = Pick<
  SaveCustomerInput,
  'cpf' | 'phone' | 'address' | 'isActive'
>;

// Only these fields reach the use case: `id` and `userId` in the body are always
// discarded, and each controller decides about `isActive`. A missing address
// still yields every field, so the domain reports each one as invalid.
export function toInput(body: SaveCustomerBody): SaveCustomerFields {
  const address: Partial<SaveCustomerBody['address']> = body?.address ?? {};
  return {
    cpf: body?.cpf,
    phone: body?.phone,
    address: {
      zipCode: address.zipCode as string,
      street: address.street as string,
      number: address.number as string,
      complement: address.complement,
      neighborhood: address.neighborhood as string,
      city: address.city as string,
      state: address.state as string,
    },
    isActive: body?.isActive,
  };
}

export function throwFailure(errors: string[]): never {
  // Value objects may repeat a code; the API exposes each code once.
  const codes = [...new Set(errors)];
  if (
    codes.includes(CustomerErrors.CUSTOMER_NOT_FOUND) ||
    codes.includes(CustomerErrors.CUSTOMER_USER_NOT_FOUND)
  ) {
    throw new NotFoundException(codes);
  }
  if (
    codes.includes(CustomerErrors.CUSTOMER_CPF_ALREADY_EXISTS) ||
    codes.includes(CustomerErrors.CUSTOMER_ALREADY_EXISTS)
  ) {
    throw new ConflictException(codes);
  }
  throw new BadRequestException(codes);
}
