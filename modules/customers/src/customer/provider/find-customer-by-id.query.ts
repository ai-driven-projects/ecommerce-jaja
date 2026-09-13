import { Result } from '@mentoria-360/shared'
import { CustomerDetailDTO } from '../dto'

// Resolves to `null` when the customer does not exist or is deleted.
export interface FindCustomerByIdQuery {
  execute(id: string): Promise<Result<CustomerDetailDTO | null>>
}
