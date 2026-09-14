import { Id, Result } from '@mentoria-360/shared'
import { Brand, DeleteBrand } from '../../src/brand'
import { Category } from '../../src/category'
import {
  DeleteProduct,
  Product,
  SaveProduct,
  SaveProductInput,
} from '../../src/product'
import { InMemoryBrandRepository } from '../mock/in-memory-brand.repository'
import { InMemoryCategoryRepository } from '../mock/in-memory-category.repository'
import { InMemoryProductRepository } from '../mock/in-memory-product.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'
const unknownId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const bicId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const escritaId = '3d6f4e2a-1b5c-4d7e-9f8a-0b1c2d3e4f5a'
const canetasId = '7c9e6679-7425-40de-944b-e07fc1f90ae7'

function image(name: string, order: number) {
  return {
    thumbUrl: `https://exemplo.com/${name}-thumb.jpg`,
    largeUrl: `https://exemplo.com/${name}-large.jpg`,
    order,
  }
}

// Brand BIC and categories "Escrita & Corretivos > Canetas".
async function setup() {
  const productRepository = new InMemoryProductRepository()
  const brandRepository = new InMemoryBrandRepository()
  const categoryRepository = new InMemoryCategoryRepository()
  await brandRepository.create(Brand.create({ id: bicId, name: 'BIC' }))
  await categoryRepository.create(
    Category.create({ id: escritaId, name: 'Escrita & Corretivos' }),
  )
  await categoryRepository.create(
    Category.create({ id: canetasId, name: 'Canetas', parentId: escritaId }),
  )
  const useCase = new SaveProduct(
    productRepository,
    brandRepository,
    categoryRepository,
  )
  return { productRepository, brandRepository, useCase }
}

const caneta: SaveProductInput = {
  name: 'Caneta Esferográfica Azul',
  brandId: bicId,
  categoryId: canetasId,
  priceCents: 390,
}

async function save(useCase: SaveProduct, input: SaveProductInput) {
  const result = await useCase.execute(input)
  if (result.isFailure) throw new Error(result.errors.join(', '))
  return result.instance
}

async function find(repository: InMemoryProductRepository, productId: string) {
  return (await repository.findById(productId)).instance
}

describe('SaveProduct', () => {
  describe('creation', () => {
    test('creates with a uuid v4 and the defaults', async () => {
      const { productRepository, useCase } = await setup()

      const result = await useCase.execute(caneta)

      expect(result.isOk).toBe(true)
      const product = result.instance
      expect(product).toBeInstanceOf(Product)
      expect(Id.isValid(product.id)).toBe(true)
      expect(product.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4/)
      expect(product).toMatchObject({
        name: 'Caneta Esferográfica Azul',
        slug: 'caneta-esferografica-azul',
        sku: null,
        brandId: bicId,
        categoryId: canetasId,
        description: null,
        priceCents: 390,
        listPriceCents: null,
        unit: 'unidade',
        images: [],
        isActive: true,
      })
      expect((await find(productRepository, product.id)).name).toBe(
        'Caneta Esferográfica Azul',
      )
    })

    test('creates with every attribute and normalizes the images', async () => {
      const { useCase } = await setup()

      const product = await save(useCase, {
        ...caneta,
        slug: 'caneta-bic-azul',
        sku: '026106',
        description: 'Ponta média',
        priceCents: 1000,
        listPriceCents: 1290,
        unit: 'caixa com 50',
        images: [image('a', 5), image('b', 2)],
        isActive: false,
      })

      expect(product).toMatchObject({
        slug: 'caneta-bic-azul',
        sku: '026106',
        description: 'Ponta média',
        priceCents: 1000,
        listPriceCents: 1290,
        unit: 'caixa com 50',
        images: [image('b', 0), image('a', 1)],
        isActive: false,
      })
    })

    test('creates with isFeatured false when it is omitted', async () => {
      const { productRepository, useCase } = await setup()

      const product = await save(useCase, caneta)

      expect(product.isFeatured).toBe(false)
      expect((await find(productRepository, product.id)).isFeatured).toBe(false)
    })

    test('creates with isFeatured true when it is given', async () => {
      const { productRepository, useCase } = await setup()

      const product = await save(useCase, { ...caneta, isFeatured: true })

      expect(product.isFeatured).toBe(true)
      expect((await find(productRepository, product.id)).isFeatured).toBe(true)
    })

    test('creates without brand and in a root category', async () => {
      const { useCase } = await setup()

      const product = await save(useCase, {
        name: 'Papel Sulfite A4 Chamex',
        categoryId: escritaId,
        priceCents: 2990,
      })

      expect(product.brandId).toBeNull()
      expect(product.categoryId).toBe(escritaId)
      expect(product.slug).toBe('papel-sulfite-a4-chamex')
    })

    test('creates several products without sku', async () => {
      const { productRepository, useCase } = await setup()

      await save(useCase, { ...caneta, name: 'Caneta Azul' })
      await save(useCase, { ...caneta, name: 'Caneta Preta' })

      expect(productRepository.size).toBe(2)
    })

    test('fails with BRAND_NOT_FOUND for an unknown brand', async () => {
      const { productRepository, useCase } = await setup()

      const result = await useCase.execute({ ...caneta, brandId: unknownId })

      expect(result.errors).toEqual(['BRAND_NOT_FOUND'])
      expect(productRepository.size).toBe(0)
    })

    test('fails with BRAND_NOT_FOUND for a deleted brand', async () => {
      const { productRepository, brandRepository, useCase } = await setup()
      await new DeleteBrand(brandRepository, productRepository).execute({
        id: bicId,
      })

      const result = await useCase.execute(caneta)

      expect(result.errors).toEqual(['BRAND_NOT_FOUND'])
      expect(productRepository.size).toBe(0)
    })

    test('fails with CATEGORY_NOT_FOUND for an unknown category', async () => {
      const { productRepository, useCase } = await setup()

      const result = await useCase.execute({ ...caneta, categoryId: unknownId })

      expect(result.errors).toEqual(['CATEGORY_NOT_FOUND'])
      expect(productRepository.size).toBe(0)
    })

    test('fails with PRODUCT_SLUG_ALREADY_EXISTS for a used slug', async () => {
      const { productRepository, useCase } = await setup()
      await save(useCase, caneta)

      const result = await useCase.execute({
        ...caneta,
        name: 'Outra Caneta',
        slug: 'caneta-esferografica-azul',
      })

      expect(result.errors).toEqual(['PRODUCT_SLUG_ALREADY_EXISTS'])
      expect(productRepository.size).toBe(1)
    })

    test('fails with PRODUCT_SLUG_ALREADY_EXISTS for a slug derived from the same name', async () => {
      const { productRepository, useCase } = await setup()
      await save(useCase, caneta)

      const result = await useCase.execute(caneta)

      expect(result.errors).toEqual(['PRODUCT_SLUG_ALREADY_EXISTS'])
      expect(productRepository.size).toBe(1)
    })

    test('fails with PRODUCT_SKU_ALREADY_EXISTS for a used sku', async () => {
      const { productRepository, useCase } = await setup()
      await save(useCase, { ...caneta, sku: '026106' })

      const result = await useCase.execute({
        ...caneta,
        name: 'Caneta Preta',
        sku: '026106',
      })

      expect(result.errors).toEqual(['PRODUCT_SKU_ALREADY_EXISTS'])
      expect(productRepository.size).toBe(1)
    })

    test('keeps the slug and sku of a deleted product reserved', async () => {
      const { productRepository, useCase } = await setup()
      const deleted = await save(useCase, { ...caneta, sku: '026106' })
      await new DeleteProduct(productRepository).execute({ id: deleted.id })

      const sameSlug = await useCase.execute(caneta)
      const sameSku = await useCase.execute({
        ...caneta,
        name: 'Caneta Preta',
        sku: '026106',
      })

      expect(sameSlug.errors).toEqual(['PRODUCT_SLUG_ALREADY_EXISTS'])
      expect(sameSku.errors).toEqual(['PRODUCT_SKU_ALREADY_EXISTS'])
      expect(productRepository.size).toBe(1)
    })

    test('creates with the given id when it does not belong to any product', async () => {
      const { productRepository, useCase } = await setup()
      const create = jest.spyOn(productRepository, 'create')
      const update = jest.spyOn(productRepository, 'update')

      const result = await useCase.execute({ ...caneta, id })

      expect(result.instance.id).toBe(id)
      expect(create).toHaveBeenCalledWith(expect.any(Product))
      expect(update).not.toHaveBeenCalled()
      expect((await find(productRepository, id)).name).toBe(
        'Caneta Esferográfica Azul',
      )
    })

    test.each([
      [{ priceCents: 0 }, 'MONEY_CENTS_INVALID'],
      [{ name: '  Ab  ' }, 'PRODUCT_NAME_TOO_SHORT'],
      [
        { priceCents: 1000, listPriceCents: 900 },
        'PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE',
      ],
      [
        { images: Array.from({ length: 11 }, (_, index) => image(`i${index}`, index)) },
        'PRODUCT_IMAGES_LIMIT_EXCEEDED',
      ],
      [{ slug: 'Caneta Azul' }, 'INVALID_ALIAS'],
    ])(
      'fails with a validation error before any lookup and stores nothing (%o)',
      async (changes, code) => {
        const { productRepository, brandRepository, useCase } = await setup()
        const findBrand = jest.spyOn(brandRepository, 'findById')

        const result = await useCase.execute({ ...caneta, ...changes })

        expect(result.errors).toEqual([code])
        expect(findBrand).not.toHaveBeenCalled()
        expect(productRepository.size).toBe(0)
      },
    )

    test('fails with INVALID_ID for a malformed id', async () => {
      const { productRepository, useCase } = await setup()

      const result = await useCase.execute({ ...caneta, id: 'abc' })

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(productRepository.size).toBe(0)
    })

    test('propagates a findById failure other than PRODUCT_NOT_FOUND', async () => {
      const { productRepository, useCase } = await setup()
      jest
        .spyOn(productRepository, 'findById')
        .mockResolvedValue(Result.fail('DB_ERROR'))

      const result = await useCase.execute({ ...caneta, id })

      expect(result.errors).toEqual(['DB_ERROR'])
      expect(productRepository.size).toBe(0)
    })
  })

  describe('update', () => {
    test('keeps its own slug and sku without conflict', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, { ...caneta, sku: '026106' })
      const update = jest.spyOn(productRepository, 'update')

      const result = await useCase.execute({
        ...caneta,
        id: created.id,
        slug: 'caneta-esferografica-azul',
        sku: '026106',
        priceCents: 450,
      })

      expect(result.isOk).toBe(true)
      expect(update).toHaveBeenCalledTimes(1)
      expect(await find(productRepository, created.id)).toMatchObject({
        slug: 'caneta-esferografica-azul',
        sku: '026106',
        priceCents: 450,
      })
      expect(productRepository.size).toBe(1)
    })

    test('replaces the images (A, B, C becomes C, D)', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, {
        ...caneta,
        images: [image('a', 0), image('b', 1), image('c', 2)],
      })

      await save(useCase, {
        ...caneta,
        id: created.id,
        images: [image('c', 0), image('d', 1)],
      })

      expect((await find(productRepository, created.id)).images).toEqual([
        image('c', 0),
        image('d', 1),
      ])
    })

    test('leaves the product without images when images is omitted', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, { ...caneta, images: [image('a', 0)] })

      await save(useCase, { ...caneta, id: created.id })

      expect((await find(productRepository, created.id)).images).toEqual([])
    })

    test('keeps the current slug when slug is omitted', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, caneta)

      await save(useCase, { ...caneta, id: created.id, name: 'Caneta BIC Azul' })

      expect(await find(productRepository, created.id)).toMatchObject({
        name: 'Caneta BIC Azul',
        slug: 'caneta-esferografica-azul',
      })
    })

    test('keeps undefined fields and clears null ones', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, {
        ...caneta,
        sku: '026106',
        description: 'Ponta média',
        priceCents: 1000,
        listPriceCents: 1290,
        unit: 'caixa com 50',
        isActive: false,
      })

      await save(useCase, {
        id: created.id,
        name: caneta.name,
        categoryId: canetasId,
        priceCents: 1000,
      })
      expect(await find(productRepository, created.id)).toMatchObject({
        sku: '026106',
        brandId: bicId,
        description: 'Ponta média',
        listPriceCents: 1290,
        unit: 'caixa com 50',
        isActive: false,
      })

      await save(useCase, {
        ...caneta,
        id: created.id,
        sku: null,
        brandId: null,
        description: '',
        listPriceCents: null,
        unit: null,
        priceCents: 1000,
      })
      expect(await find(productRepository, created.id)).toMatchObject({
        sku: null,
        brandId: null,
        description: null,
        listPriceCents: null,
        unit: 'unidade',
        isActive: false,
      })
    })

    test('keeps isFeatured when it is omitted', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, { ...caneta, isFeatured: true })

      await save(useCase, { ...caneta, id: created.id, priceCents: 450 })

      expect(await find(productRepository, created.id)).toMatchObject({
        priceCents: 450,
        isFeatured: true,
      })
    })

    test('changes isFeatured to false', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, { ...caneta, isFeatured: true })

      await save(useCase, { ...caneta, id: created.id, isFeatured: false })

      expect((await find(productRepository, created.id)).isFeatured).toBe(false)
    })

    test('refreshes updatedAt and keeps createdAt', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, caneta)
      await new Promise((resolve) => setTimeout(resolve, 5))

      await save(useCase, { ...caneta, id: created.id, priceCents: 450 })

      const updated = await find(productRepository, created.id)
      expect(updated.createdAt).toEqual(created.createdAt)
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        created.updatedAt.getTime(),
      )
    })

    test('fails with PRODUCT_SLUG_ALREADY_EXISTS for the slug of another product', async () => {
      const { productRepository, useCase } = await setup()
      await save(useCase, caneta)
      const preta = await save(useCase, { ...caneta, name: 'Caneta Preta' })

      const result = await useCase.execute({
        ...caneta,
        id: preta.id,
        name: 'Caneta Preta',
        slug: 'caneta-esferografica-azul',
      })

      expect(result.errors).toEqual(['PRODUCT_SLUG_ALREADY_EXISTS'])
      expect((await find(productRepository, preta.id)).slug).toBe('caneta-preta')
    })

    test('fails with PRODUCT_SKU_ALREADY_EXISTS for the sku of another product', async () => {
      const { productRepository, useCase } = await setup()
      await save(useCase, { ...caneta, sku: '026106' })
      const preta = await save(useCase, {
        ...caneta,
        name: 'Caneta Preta',
        sku: '027242',
      })

      const result = await useCase.execute({
        ...caneta,
        id: preta.id,
        name: 'Caneta Preta',
        sku: '026106',
      })

      expect(result.errors).toEqual(['PRODUCT_SKU_ALREADY_EXISTS'])
      expect((await find(productRepository, preta.id)).sku).toBe('027242')
    })

    test('fails with PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE and keeps the product unchanged', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, { ...caneta, priceCents: 1000 })
      const update = jest.spyOn(productRepository, 'update')

      const result = await useCase.execute({
        ...caneta,
        id: created.id,
        priceCents: 1000,
        listPriceCents: 900,
      })

      expect(result.errors).toEqual(['PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE'])
      expect(update).not.toHaveBeenCalled()
      expect((await find(productRepository, created.id)).listPriceCents).toBeNull()
    })

    test('fails with CATEGORY_NOT_FOUND when moving to an unknown category', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, caneta)

      const result = await useCase.execute({
        ...caneta,
        id: created.id,
        categoryId: unknownId,
      })

      expect(result.errors).toEqual(['CATEGORY_NOT_FOUND'])
      expect((await find(productRepository, created.id)).categoryId).toBe(
        canetasId,
      )
    })

    test('fails with PRODUCT_NOT_FOUND for the id of a deleted product', async () => {
      const { productRepository, useCase } = await setup()
      const created = await save(useCase, caneta)
      await new DeleteProduct(productRepository).execute({ id: created.id })

      const result = await useCase.execute({ ...caneta, id: created.id })

      expect(result.errors).toEqual(['PRODUCT_NOT_FOUND'])
      expect(productRepository.size).toBe(1)
    })
  })
})
