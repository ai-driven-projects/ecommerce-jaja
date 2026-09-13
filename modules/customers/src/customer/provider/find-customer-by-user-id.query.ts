import { Result } from '@mentoria-360/shared'
import { CustomerDetailDTO } from '../dto'

// Resolves to `null` when the user has no customer yet (or it is deleted).
export interface FindCustomerByUserIdQuery {
  execute(userId: string): Promise<Result<CustomerDetailDTO | null>>
}
