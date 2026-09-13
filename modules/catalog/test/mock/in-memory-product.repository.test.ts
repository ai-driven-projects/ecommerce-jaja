import { Product, ProductProps } from '../../src/product'
import { InMemoryProductRepository } from './in-memory-product.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'
const otherId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const brandId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const categoryId = '3d6f4e2a-1b5c-4d7e-9f8a-0b1c2d3e4f5a'

const valid: ProductProps = {
  id,
  name: 'Caneta Azul',
  sku: '026106',
  brandId,
  categoryId,
  priceCents: 390,
}

function image(name: string, order: number) {
  return {
    thumbUrl: `https://exemplo.com/${name}-thumb.jpg`,
    largeUrl: `https://exemplo.com/${name}-large.jpg`,
    order,
  }
}

async function setup() {
  const repository = new InMemoryProductRepository()
  const product = Product.create(valid)
  await repository.create(product)
  return { repository, product }
}

describe('InMemoryProductRepository', () => {
  test('finds a stored product by id, slug and sku', async () => {
    const { repository } = await setup()

    expect((await repository.findById(id)).instance.name).toBe('Caneta Azul')
    expect((await repository.findBySlug('caneta-azul')).instance?.id).toBe(id)
    expect((await repository.findBySku('026106')).instance?.id).toBe(id)
  })

  test('findBySku of a missing sku resolves to Result.ok(null)', async () => {
    const { repository } = await setup()

    const result = await repository.findBySku('999999')

    expect(result.isOk).toBe(true)
    expect(result.instance).toBeNull()
  })

  test('findById fails with PRODUCT_NOT_FOUND for an unknown id', async () => {
    const { repository } = await setup()

    expect((await repository.findById(otherId)).errors).toEqual([
      'PRODUCT_NOT_FOUND',
    ])
  })

  test('existsByBrandId and existsByCategoryId consider linked products', async () => {
    const { repository } = await setup()

    expect((await repository.existsByBrandId(brandId)).instance).toBe(true)
    expect((await repository.existsByCategoryId(categoryId)).instance).toBe(true)
    expect((await repository.existsByBrandId(otherId)).instance).toBe(false)
    expect((await repository.existsByCategoryId(otherId)).instance).toBe(false)
  })

  test('delete is soft and hides the product from every lookup', async () => {
    const { repository } = await setup()

    const result = await repository.delete(id)

    expect(result.isOk).toBe(true)
    expect(repository.size).toBe(1)
    expect((await repository.findById(id)).errors).toEqual(['PRODUCT_NOT_FOUND'])
    expect((await repository.findBySlug('caneta-azul')).instance).toBeNull()
    expect((await repository.findBySku('026106')).instance).toBeNull()
    expect((await repository.existsByCategoryId(categoryId)).instance).toBe(false)
  })

  test('existsByBrandId is false after deleting the only product of the brand', async () => {
    const { repository } = await setup()

    await repository.delete(id)

    const result = await repository.existsByBrandId(brandId)
    expect(result.isOk).toBe(true)
    expect(result.instance).toBe(false)
  })

  test('delete fails with PRODUCT_NOT_FOUND for a deleted product', async () => {
    const { repository } = await setup()
    await repository.delete(id)

    expect((await repository.delete(id)).errors).toEqual(['PRODUCT_NOT_FOUND'])
  })

  test('update replaces the image list', async () => {
    const repository = new InMemoryProductRepository()
    const product = Product.create({
      ...valid,
      images: [image('a', 0), image('b', 1), image('c', 2)],
    })
    await repository.create(product)

    const changed = product.cloneWith({ images: [image('c', 0), image('d', 1)] })
    const result = await repository.update(changed.instance)

    expect(result.isOk).toBe(true)
    expect((await repository.findById(id)).instance.images).toEqual([
      image('c', 0),
      image('d', 1),
    ])
  })

  test('update fails with PRODUCT_NOT_FOUND for a deleted product', async () => {
    const { repository, product } = await setup()
    await repository.delete(id)

    expect((await repository.update(product)).errors).toEqual([
      'PRODUCT_NOT_FOUND',
    ])
  })

  test('create fails with PRODUCT_NOT_FOUND for a taken id', async () => {
    const { repository, product } = await setup()

    expect((await repository.create(product)).errors).toEqual([
      'PRODUCT_NOT_FOUND',
    ])
  })

  test('create keeps the slug and sku of deleted products reserved', async () => {
    const { repository } = await setup()
    await repository.delete(id)

    const sameSlug = Product.create({ ...valid, id: otherId, sku: null })
    const sameSku = Product.create({ ...valid, id: otherId, slug: 'outra-caneta' })

    expect((await repository.create(sameSlug)).errors).toEqual([
      'PRODUCT_SLUG_ALREADY_EXISTS',
    ])
    expect((await repository.create(sameSku)).errors).toEqual([
      'PRODUCT_SKU_ALREADY_EXISTS',
    ])
  })

  test('accepts several products without sku', async () => {
    const repository = new InMemoryProductRepository()

    const first = await repository.create(
      Product.create({ ...valid, sku: null }),
    )
    const second = await repository.create(
      Product.create({ ...valid, id: otherId, name: 'Lápis Preto', sku: null }),
    )

    expect(first.isOk).toBe(true)
    expect(second.isOk).toBe(true)
  })
})
