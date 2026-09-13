import { ProductName } from '../../src/product'

describe('ProductName', () => {
  test('fails with PRODUCT_NAME_TOO_SHORT for 2 characters', () => {
    const result = ProductName.tryCreate('Ab')

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['PRODUCT_NAME_TOO_SHORT'])
  })

  test('fails with PRODUCT_NAME_TOO_SHORT when only spaces make it long enough', () => {
    const result = ProductName.tryCreate('  Ab  ')

    expect(result.errors).toEqual(['PRODUCT_NAME_TOO_SHORT'])
  })

  test('accepts 3 characters', () => {
    const result = ProductName.tryCreate('Abc')

    expect(result.isOk).toBe(true)
    expect(result.instance.value).toBe('Abc')
  })

  test('accepts 255 characters', () => {
    const result = ProductName.tryCreate('a'.repeat(255))

    expect(result.isOk).toBe(true)
  })

  test('fails with PRODUCT_NAME_TOO_LONG for 256 characters', () => {
    const result = ProductName.tryCreate('a'.repeat(256))

    expect(result.errors).toEqual(['PRODUCT_NAME_TOO_LONG'])
  })

  test('trims the value', () => {
    const name = ProductName.create('  Borracha  ')

    expect(name.value).toBe('Borracha')
    expect(name).toBeInstanceOf(ProductName)
  })

  test('create throws on an invalid value', () => {
    expect(() => ProductName.create('A')).toThrow()
  })
})
