import { Product, ProductProps } from '../../src/product'

const id = '550e8400-e29b-41d4-a716-446655440000'
const brandId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const categoryId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'

const valid: ProductProps = {
  name: 'Caneta Esferográfica Azul',
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

describe('Product', () => {
  test('creates with every attribute', () => {
    const result = Product.tryCreate({
      id,
      name: 'Caneta Esferográfica Azul',
      slug: 'caneta-azul',
      sku: '026106',
      brandId,
      categoryId,
      description: 'Ponta média',
      priceCents: 390,
      listPriceCents: 450,
      unit: 'caixa com 50',
      images: [image('a', 0)],
      isActive: false,
    })

    expect(result.isOk).toBe(true)
    expect(result.instance).toMatchObject({
      id,
      name: 'Caneta Esferográfica Azul',
      slug: 'caneta-azul',
      sku: '026106',
      brandId,
      categoryId,
      description: 'Ponta média',
      priceCents: 390,
      listPriceCents: 450,
      unit: 'caixa com 50',
      images: [image('a', 0)],
      isActive: false,
    })
  })

  test('applies the defaults when only the required attributes are given', () => {
    const product = Product.create(valid)

    expect(product.slug).toBe('caneta-esferografica-azul')
    expect(product.unit).toBe('unidade')
    expect(product.isActive).toBe(true)
    expect(product.images).toEqual([])
    expect(product.mainImage).toBeNull()
    expect(product.sku).toBeNull()
    expect(product.brandId).toBeNull()
    expect(product.description).toBeNull()
    expect(product.listPriceCents).toBeNull()
  })

  test('uses the default unit for a blank unit and derives the slug of a blank slug', () => {
    const product = Product.create({ ...valid, unit: '  ', slug: '' })

    expect(product.unit).toBe('unidade')
    expect(product.slug).toBe('caneta-esferografica-azul')
  })

  test('trims the name', () => {
    const product = Product.create({ ...valid, name: '  Borracha Branca  ' })

    expect(product.name).toBe('Borracha Branca')
    expect(product.slug).toBe('borracha-branca')
  })

  test('fails with PRODUCT_NAME_TOO_SHORT for a short name', () => {
    const result = Product.tryCreate({ ...valid, name: '  Ab  ' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toContain('PRODUCT_NAME_TOO_SHORT')
  })

  test('fails with MONEY_CENTS_INVALID for a zero price', () => {
    const result = Product.tryCreate({ ...valid, priceCents: 0 })

    expect(result.errors).toEqual(['MONEY_CENTS_INVALID'])
  })

  test('fails with MONEY_CENTS_INVALID for a zero list price', () => {
    const result = Product.tryCreate({ ...valid, listPriceCents: 0 })

    expect(result.errors).toEqual(['MONEY_CENTS_INVALID'])
  })

  test.each([1000, 900])(
    'fails with PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE for listPriceCents %p and priceCents 1000',
    (listPriceCents) => {
      const result = Product.tryCreate({
        ...valid,
        priceCents: 1000,
        listPriceCents,
      })

      expect(result.errors).toEqual([
        'PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE',
      ])
    },
  )

  test('accepts a list price greater than the price', () => {
    const product = Product.create({
      ...valid,
      priceCents: 1000,
      listPriceCents: 1290,
    })

    expect(product.priceCents).toBe(1000)
    expect(product.listPriceCents).toBe(1290)
  })

  test('fails with PRODUCT_IMAGES_LIMIT_EXCEEDED for 11 images', () => {
    const images = Array.from({ length: 11 }, (_, index) =>
      image(`img${index}`, index),
    )

    const result = Product.tryCreate({ ...valid, images })

    expect(result.errors).toEqual(['PRODUCT_IMAGES_LIMIT_EXCEEDED'])
  })

  test('accepts 10 images', () => {
    const images = Array.from({ length: 10 }, (_, index) =>
      image(`img${index}`, index),
    )

    expect(Product.tryCreate({ ...valid, images }).isOk).toBe(true)
  })

  test('fails with INVALID_URL for an invalid image url', () => {
    const result = Product.tryCreate({
      ...valid,
      images: [{ ...image('a', 0), largeUrl: 'ftp://x' }],
    })

    expect(result.errors).toEqual(['INVALID_URL'])
  })

  test('normalizes the image order (5, 2, 9 becomes B, A, C)', () => {
    const product = Product.create({
      ...valid,
      images: [image('a', 5), image('b', 2), image('c', 9)],
    })

    expect(product.images).toEqual([image('b', 0), image('a', 1), image('c', 2)])
  })

  test('keeps the list position for images with the same order', () => {
    const product = Product.create({
      ...valid,
      images: [image('a', 1), image('b', 0), image('c', 1)],
    })

    expect(product.images.map((item) => item.thumbUrl)).toEqual([
      image('b', 0).thumbUrl,
      image('a', 0).thumbUrl,
      image('c', 0).thumbUrl,
    ])
  })

  test('mainImage is the image with the lowest order', () => {
    const product = Product.create({
      ...valid,
      images: [image('a', 5), image('b', 2), image('c', 9)],
    })

    expect(product.mainImage).toEqual(image('b', 0))
  })

  test('images returns copies that do not change the entity', () => {
    const product = Product.create({ ...valid, images: [image('a', 0)] })

    product.images[0]!.thumbUrl = 'https://exemplo.com/outra.jpg'

    expect(product.mainImage?.thumbUrl).toBe(image('a', 0).thumbUrl)
  })

  test('fails with INVALID_ID for a missing categoryId', () => {
    const result = Product.tryCreate({ ...valid, categoryId: '' })

    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails with INVALID_ID for a malformed brandId', () => {
    const result = Product.tryCreate({ ...valid, brandId: 'abc' })

    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails with TEXT_TOO_LONG for a sku or unit with 41 characters', () => {
    expect(
      Product.tryCreate({ ...valid, sku: 'a'.repeat(41) }).errors,
    ).toEqual(['TEXT_TOO_LONG'])
    expect(
      Product.tryCreate({ ...valid, unit: 'a'.repeat(41) }).errors,
    ).toEqual(['TEXT_TOO_LONG'])
  })

  test('fails with INVALID_ALIAS for an invalid slug', () => {
    const result = Product.tryCreate({ ...valid, slug: 'caneta azul' })

    expect(result.errors).toEqual(['INVALID_ALIAS'])
  })

  test('fails with PRODUCT_DESCRIPTION_TOO_LONG for 5001 characters', () => {
    const result = Product.tryCreate({ ...valid, description: 'a'.repeat(5001) })

    expect(result.errors).toEqual(['PRODUCT_DESCRIPTION_TOO_LONG'])
  })

  test('combines the errors of several invalid attributes', () => {
    const result = Product.tryCreate({
      ...valid,
      name: 'A',
      priceCents: -1,
      images: [{ ...image('a', 0), thumbUrl: '' }],
    })

    expect(result.errors).toEqual(
      expect.arrayContaining([
        'PRODUCT_NAME_TOO_SHORT',
        'MONEY_CENTS_INVALID',
        'INVALID_URL',
      ]),
    )
  })

  test('create throws on invalid props', () => {
    expect(() => Product.create({ ...valid, priceCents: 0 })).toThrow()
  })

  test('cloneWith replaces the images and clears null props', () => {
    const product = Product.create({
      ...valid,
      id,
      brandId,
      sku: '026106',
      images: [image('a', 0), image('b', 1), image('c', 2)],
    })

    const result = product.cloneWith({
      brandId: null,
      images: [image('c', 0), image('d', 1)],
    })

    expect(result.instance.images).toEqual([image('c', 0), image('d', 1)])
    expect(result.instance.brandId).toBeNull()
    expect(result.instance.sku).toBe('026106')
    expect(product.images).toHaveLength(3)
  })

  test('cloneWith revalidates the changed props', () => {
    const product = Product.create({ ...valid, id, priceCents: 1000 })

    expect(product.cloneWith({ listPriceCents: 500 }).errors).toEqual([
      'PRODUCT_LIST_PRICE_NOT_GREATER_THAN_PRICE',
    ])
  })

  test('equals compares by id', () => {
    const a = Product.create({ ...valid, id })
    const b = Product.create({ ...valid, id, name: 'Outro nome' })
    const c = Product.create(valid)

    expect(a.equals(b)).toBe(true)
    expect(a.notEquals(c)).toBe(true)
  })
})
