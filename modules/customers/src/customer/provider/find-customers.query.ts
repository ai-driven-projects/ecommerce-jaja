import { Result } from '@mentoria-360/shared'
import { CustomerFiltersDTO, CustomerPageDTO } from '../dto'

// One page of non-deleted customers, with `name` and `email` of the linked
// user. Without `search` they come ordered by the user's name (ignoring case
// and accents); with `search`, every term must match the start of a word in the
// user's name or email, the CPF, the phone or the neighborhood, best matches
// first. Terms made only of digits, dots, dashes, parentheses and spaces are
// reduced to their digits, so a masked CPF or phone is found. `isActive`
// filters by status when defined.
export interface FindCustomersQuery {
  execute(filter: CustomerFiltersDTO): Promise<Result<CustomerPageDTO>>
}
