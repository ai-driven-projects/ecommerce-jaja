import { Result } from '@mentoria-360/shared'
import { Category, DeleteCategory } from '../../src/category'
import { Product } from '../../src/product'
import { InMemoryCategoryRepository } from '../mock/in-memory-category.repository'
import { InMemoryProductRepository } from '../mock/in-memory-product.repository'

const escolarId = '550e8400-e29b-41d4-a716-446655440000'
const borrachasId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

// Escolar > Borrachas
async function setup() {
  const repository = new InMemoryCategoryRepository()
  const productRepository = new InMemoryProductRepository()
  const useCase = new DeleteCategory(repository, productRepository)
  await repository.create(Category.create({ id: escolarId, name: 'Escolar' }))
  await repository.create(
    Category.create({ id: borrachasId, name: 'Borrachas', parentId: escolarId }),
  )
  return { repository, productRepository, useCase }
}

async function addProduct(
  productRepository: InMemoryProductRepository,
  categoryId: string,
  name = 'Borracha Branca',
) {
  const product = Product.create({ name, categoryId, priceCents: 150 })
  await productRepository.create(product)
  return product
}

async function listIds(repository: InMemoryCategoryRepository) {
  return (await repository.findAll()).instance.map((category) => category.id)
}

describe('DeleteCategory', () => {
  test('soft deletes a leaf so it disappears from the lookups', async () => {
    const { repository, useCase } = await setup()

    const result = await useCase.execute({ id: borrachasId })

    expect(result.isOk).toBe(true)
    expect(await listIds(repository)).toEqual([escolarId])
    expect((await repository.findById(borrachasId)).errors).toEqual([
      'CATEGORY_NOT_FOUND',
    ])
    expect((await repository.findBySlug('borrachas')).instance).toBeNull()
    expect((await repository.findByParentId(escolarId)).instance).toEqual([])
    expect(repository.size).toBe(2)
  })

  test('fails with CATEGORY_HAS_CHILDREN and deletes nothing', async () => {
    const { repository, useCase } = await setup()
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({ id: escolarId })

    expect(result.errors).toEqual(['CATEGORY_HAS_CHILDREN'])
    expect(remove).not.toHaveBeenCalled()
    expect(await listIds(repository)).toEqual([escolarId, borrachasId])
  })

  test('deletes the parent once its children are deleted', async () => {
    const { repository, useCase } = await setup()
    await useCase.execute({ id: borrachasId })

    const result = await useCase.execute({ id: escolarId })

    expect(result.isOk).toBe(true)
    expect(await listIds(repository)).toEqual([])
  })

  test('fails with CATEGORY_HAS_PRODUCTS and deletes nothing for a leaf with products', async () => {
    const { repository, productRepository, useCase } = await setup()
    await addProduct(productRepository, borrachasId)
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({ id: borrachasId })

    expect(result.errors).toEqual(['CATEGORY_HAS_PRODUCTS'])
    expect(remove).not.toHaveBeenCalled()
    expect(await listIds(repository)).toEqual([escolarId, borrachasId])
  })

  test('keeps failing with CATEGORY_HAS_CHILDREN for a category with children and products', async () => {
    const { productRepository, useCase } = await setup()
    await addProduct(productRepository, escolarId)
    const exists = jest.spyOn(productRepository, 'existsByCategoryId')

    const result = await useCase.execute({ id: escolarId })

    expect(result.errors).toEqual(['CATEGORY_HAS_CHILDREN'])
    expect(exists).not.toHaveBeenCalled()
  })

  test('deletes a leaf whose products are all deleted', async () => {
    const { repository, productRepository, useCase } = await setup()
    const product = await addProduct(productRepository, borrachasId)
    await productRepository.delete(product.id)

    const result = await useCase.execute({ id: borrachasId })

    expect(result.isOk).toBe(true)
    expect(await listIds(repository)).toEqual([escolarId])
  })

  test('fails with CATEGORY_NOT_FOUND for an unknown id', async () => {
    const { repository, useCase } = await setup()
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({
      id: '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c',
    })

    expect(result.errors).toEqual(['CATEGORY_NOT_FOUND'])
    expect(remove).not.toHaveBeenCalled()
  })

  test('fails with CATEGORY_NOT_FOUND for an already deleted category', async () => {
    const { useCase } = await setup()
    await useCase.execute({ id: borrachasId })

    const result = await useCase.execute({ id: borrachasId })

    expect(result.errors).toEqual(['CATEGORY_NOT_FOUND'])
  })

  test('propagates a findByParentId failure without deleting', async () => {
    const { repository, useCase } = await setup()
    jest
      .spyOn(repository, 'findByParentId')
      .mockResolvedValue(Result.fail('DB_ERROR'))
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({ id: borrachasId })

    expect(result.errors).toEqual(['DB_ERROR'])
    expect(remove).not.toHaveBeenCalled()
  })

  test('propagates an existsByCategoryId failure without deleting', async () => {
    const { repository, productRepository, useCase } = await setup()
    jest
      .spyOn(productRepository, 'existsByCategoryId')
      .mockResolvedValue(Result.fail('DB_ERROR'))
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({ id: borrachasId })

    expect(result.errors).toEqual(['DB_ERROR'])
    expect(remove).not.toHaveBeenCalled()
  })
})
