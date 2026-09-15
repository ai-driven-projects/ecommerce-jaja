import { Result } from '@mentoria-360/shared'
import {
  FindOrderCustomerByUserIdQuery,
  OrderCustomerDTO,
} from '../../src/order'

// Customer records configured by the test, by `userId`; a user without a
// record resolves to `null`. Every call is recorded.
export class InMemoryFindOrderCustomerByUserIdQuery
  implements FindOrderCustomerByUserIdQuery
{
  private readonly customers = new Map<string, OrderCustomerDTO>()
  readonly calls: string[] = []

  constructor(customers: Record<string, OrderCustomerDTO> = {}) {
    for (const [userId, customer] of Object.entries(customers)) {
      this.set(userId, customer)
    }
  }

  // `null` removes the record of the user.
  set(userId: string, customer: OrderCustomerDTO | null): void {
    if (customer) this.customers.set(userId, customer)
    else this.customers.delete(userId)
  }

  async execute(userId: string): Promise<Result<OrderCustomerDTO | null>> {
    this.calls.push(userId)
    const customer = this.customers.get(userId)
    return Result.ok(customer ? structuredClone(customer) : null)
  }
}
