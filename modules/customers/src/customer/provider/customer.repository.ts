import { CrudRepository, Result } from '@mentoria-360/shared'
import { Customer } from '../model'

// Soft-deleted customers (`deletedAt` set) are never returned by any lookup.
// `findById` fails with `CustomerErrors.CUSTOMER_NOT_FOUND` when the customer is
// missing or deleted, and `delete` only fills `deletedAt`, keeping the record
// (no use case deletes customers yet). `userId` and `cpf` stay unique for
// deleted records too: `create` fails with `CUSTOMER_ALREADY_EXISTS` for a used
// `userId`, and `create`/`update` fail with `CUSTOMER_CPF_ALREADY_EXISTS` for
// the CPF of another customer.
export interface CustomerRepository extends CrudRepository<Customer> {
  // Resolves to `null` when the user has no customer yet.
  findByUserId(userId: string): Promise<Result<Customer | null>>
  // Exact match on the 11 digits; resolves to `null` when no customer has it.
  findByCpf(cpf: string): Promise<Result<Customer | null>>
}
