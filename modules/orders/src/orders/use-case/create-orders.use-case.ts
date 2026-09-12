import { Result, UseCase } from '@mentoria-360/shared'
import { Orders } from '../model'
import { OrdersRepository } from '../provider'

export interface CreateOrdersInput {
  entity: Orders
}

export class CreateOrders
  implements UseCase<CreateOrdersInput, void>
{
  constructor(
    private readonly ordersRepository: OrdersRepository,
  ) {}

  async execute(input: CreateOrdersInput): Promise<Result<void>> {
    return this.ordersRepository.create(input.entity)
  }
}
