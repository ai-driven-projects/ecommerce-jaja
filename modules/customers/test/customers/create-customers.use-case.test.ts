import {
  Customers,
  CreateCustomers,
} from '../../src/customers'
import { InMemoryCustomersRepository } from '../mock/in-memory-customers.repository'

describe('CreateCustomers', () => {
  test('should persist the aggregate in the in-memory repository', async () => {
    const repository = new InMemoryCustomersRepository()
    const useCase = new CreateCustomers(repository)
    const entity = Customers.create({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    const result = await useCase.execute({ entity })

    expect(result.isOk).toBe(true)

    const saved = await repository.findById(entity.id)

    expect(saved.isOk).toBe(true)
    expect(saved.instance).toBe(entity)
  })
})
