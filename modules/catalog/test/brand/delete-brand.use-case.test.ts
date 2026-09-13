import { Result } from '@mentoria-360/shared'
import { Brand, DeleteBrand } from '../../src/brand'
import { Product } from '../../src/product'
import { InMemoryBrandRepository } from '../mock/in-memory-brand.repository'
import { InMemoryProductRepository } from '../mock/in-memory-product.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'
const categoryId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'

async function setup() {
  const repository = new InMemoryBrandRepository()
  const productRepository = new InMemoryProductRepository()
  const useCase = new DeleteBrand(repository, productRepository)
  const brand = Brand.create({ id, name: 'Acme' })
  await repository.create(brand)
  return { repository, productRepository, useCase, brand }
}

async function addProduct(
  productRepository: InMemoryProductRepository,
  name: string,
) {
  const product = Product.create({
    name,
    brandId: id,
    categoryId,
    priceCents: 390,
  })
  await productRepository.create(product)
  return product
}

describe('DeleteBrand', () => {
  test('soft deletes the brand so lookups stop returning it', async () => {
    const { repository, useCase } = await setup()

    const result = await useCase.execute({ id })

    expect(result.isOk).toBe(true)
    expect((await repository.findById(id)).errors).toEqual(['BRAND_NOT_FOUND'])
    const bySlug = await repository.findBySlug('acme')
    expect(bySlug.isOk).toBe(true)
    expect(bySlug.instance).toBeNull()
    expect((await repository.findByName('Acme')).instance).toBeNull()
    expect(repository.size).toBe(1)
  })

  test('fails with BRAND_NOT_FOUND for an unknown id', async () => {
    const { repository, useCase } = await setup()
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    })

    expect(result.errors).toEqual(['BRAND_NOT_FOUND'])
    expect(remove).not.toHaveBeenCalled()
  })

  test('fails with BRAND_NOT_FOUND for an already deleted brand', async () => {
    const { useCase } = await setup()
    await useCase.execute({ id })

    const result = await useCase.execute({ id })

    expect(result.errors).toEqual(['BRAND_NOT_FOUND'])
  })

  test('fails with BRAND_HAS_PRODUCTS and deletes nothing when the brand has products', async () => {
    const { repository, productRepository, useCase } = await setup()
    await addProduct(productRepository, 'Caneta Azul')
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({ id })

    expect(result.errors).toEqual(['BRAND_HAS_PRODUCTS'])
    expect(remove).not.toHaveBeenCalled()
    expect((await repository.findById(id)).isOk).toBe(true)
  })

  test('deletes the brand when all its products are deleted', async () => {
    const { repository, productRepository, useCase } = await setup()
    const first = await addProduct(productRepository, 'Caneta Azul')
    const second = await addProduct(productRepository, 'Caneta Preta')
    await productRepository.delete(first.id)
    await productRepository.delete(second.id)

    const result = await useCase.execute({ id })

    expect(result.isOk).toBe(true)
    expect((await repository.findById(id)).errors).toEqual(['BRAND_NOT_FOUND'])
  })

  test('propagates an existsByBrandId failure without deleting', async () => {
    const { repository, productRepository, useCase } = await setup()
    jest
      .spyOn(productRepository, 'existsByBrandId')
      .mockResolvedValue(Result.fail('DB_ERROR'))
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({ id })

    expect(result.errors).toEqual(['DB_ERROR'])
    expect(remove).not.toHaveBeenCalled()
  })
})
