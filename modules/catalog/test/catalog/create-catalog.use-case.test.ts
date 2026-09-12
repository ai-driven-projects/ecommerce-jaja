import {
  Catalog,
  CreateCatalog,
} from '../../src/catalog'
import { InMemoryCatalogRepository } from '../mock/in-memory-catalog.repository'

describe('CreateCatalog', () => {
  test('should persist the aggregate in the in-memory repository', async () => {
    const repository = new InMemoryCatalogRepository()
    const useCase = new CreateCatalog(repository)
    const entity = Catalog.create({
      id: '550e8400-e29b-41d4-a716-446655440000',
    })

    const result = await useCase.execute({ entity })

    expect(result.isOk).toBe(true)

    const saved = await repository.findById(entity.id)

    expect(saved.isOk).toBe(true)
    expect(saved.instance).toBe(entity)
  })
})
