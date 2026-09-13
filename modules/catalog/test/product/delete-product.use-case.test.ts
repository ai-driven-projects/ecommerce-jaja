import { Result } from '@mentoria-360/shared'
import { DeleteProduct, Product } from '../../src/product'
import { InMemoryProductRepository } from '../mock/in-memory-product.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'
const categoryId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'

async function setup() {
  const repository = new InMemoryProductRepository()
  const useCase = new DeleteProduct(repository)
  await repository.create(
    Product.create({ id, name: 'Caneta Azul', categoryId, priceCents: 390 }),
  )
  return { repository, useCase }
}

describe('DeleteProduct', () => {
  test('soft deletes the product filling deletedAt', async () => {
    const { repository, useCase } = await setup()
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({ id })

    expect(result.isOk).toBe(true)
    expect(remove).toHaveBeenCalledWith(id)
    expect(repository.size).toBe(1)
    expect((await repository.findById(id)).errors).toEqual(['PRODUCT_NOT_FOUND'])
    expect((await repository.findBySlug('caneta-azul')).instance).toBeNull()
  })

  test('keeps the record with deletedAt filled', async () => {
    const { repository, useCase } = await setup()
    expect(repository.findStored(id)?.deletedAt).toBeNull()

    await useCase.execute({ id })

    expect(repository.findStored(id)?.deletedAt).toBeInstanceOf(Date)
  })

  test('propagates a delete failure', async () => {
    const { repository, useCase } = await setup()
    jest.spyOn(repository, 'delete').mockResolvedValue(Result.fail('DB_ERROR'))

    const result = await useCase.execute({ id })

    expect(result.errors).toEqual(['DB_ERROR'])
  })

  test('fails with PRODUCT_NOT_FOUND for an unknown id', async () => {
    const { repository, useCase } = await setup()
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    })

    expect(result.errors).toEqual(['PRODUCT_NOT_FOUND'])
    expect(remove).not.toHaveBeenCalled()
  })

  test('fails with PRODUCT_NOT_FOUND for an already deleted product', async () => {
    const { useCase } = await setup()
    await useCase.execute({ id })

    const result = await useCase.execute({ id })

    expect(result.errors).toEqual(['PRODUCT_NOT_FOUND'])
  })
})
