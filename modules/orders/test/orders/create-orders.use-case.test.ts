import {
  Orders,
  CreateOrders,
} from '../../src/orders'
import { InMemoryOrdersRepository } from '../mock/in-memory-orders.repository'

describe('CreateOrders', () => {
  test('should persist the aggregate in the in-memory repository', async () => {
    const repository = new InMemoryOrdersRepository()
    const useCase = new CreateOrders(repository)
    const entity = Orders.create({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    const result = await useCase.execute({ entity })

    expect(result.isOk).toBe(true)

    const saved = await repository.findById(entity.id)

    expect(saved.isOk).toBe(true)
    expect(saved.instance).toBe(entity)
  })
})
