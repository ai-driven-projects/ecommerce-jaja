import { ProductImage } from '../../src/product'

const valid = {
  thumbUrl: 'https://exemplo.com/thumb.jpg',
  largeUrl: 'https://exemplo.com/large.jpg',
  order: 0,
}

describe('ProductImage', () => {
  test('creates with valid attributes', () => {
    const result = ProductImage.tryCreate(valid)

    expect(result.isOk).toBe(true)
    expect(result.instance.thumbUrl).toBe(valid.thumbUrl)
    expect(result.instance.largeUrl).toBe(valid.largeUrl)
    expect(result.instance.order).toBe(0)
  })

  test('fails with INVALID_URL for a non http(s) thumbUrl', () => {
    const result = ProductImage.tryCreate({ ...valid, thumbUrl: 'ftp://x' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_URL'])
  })

  test('fails with INVALID_URL for an empty largeUrl', () => {
    const result = ProductImage.tryCreate({ ...valid, largeUrl: '' })

    expect(result.errors).toEqual(['INVALID_URL'])
  })

  test('fails with INVALID_ORDER for a negative order', () => {
    const result = ProductImage.tryCreate({ ...valid, order: -1 })

    expect(result.errors).toEqual(['INVALID_ORDER'])
  })

  test('combines the errors of every invalid attribute', () => {
    const result = ProductImage.tryCreate({
      thumbUrl: '',
      largeUrl: 'ftp://x',
      order: 1.5,
    })

    expect(result.errors).toEqual(['INVALID_URL', 'INVALID_URL', 'INVALID_ORDER'])
  })

  test('withOrder returns a new instance with the given order', () => {
    const image = ProductImage.create(valid)

    const moved = image.withOrder(3)

    expect(moved).not.toBe(image)
    expect(moved.order).toBe(3)
    expect(moved.thumbUrl).toBe(valid.thumbUrl)
    expect(moved.largeUrl).toBe(valid.largeUrl)
    expect(image.order).toBe(0)
  })

  test('equals compares every attribute', () => {
    const image = ProductImage.create(valid)

    expect(image.equals(ProductImage.create({ ...valid }))).toBe(true)
    expect(image.equals(image.withOrder(1))).toBe(false)
  })

  test('create throws on invalid props', () => {
    expect(() => ProductImage.create({ ...valid, order: -1 })).toThrow()
  })
})
