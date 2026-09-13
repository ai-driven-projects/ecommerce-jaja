import { ProductDescription } from '../../src/product'

describe('ProductDescription', () => {
  test.each([undefined, null, '', '   '])(
    'resolves to null when absent (%p)',
    (value) => {
      const result = ProductDescription.tryCreate(value, { optional: true })

      expect(result.isOk).toBe(true)
      expect(result.instance).toBeNull()
    },
  )

  test('accepts 5000 characters', () => {
    const result = ProductDescription.tryCreate('a'.repeat(5000), {
      optional: true,
    })

    expect(result.isOk).toBe(true)
    expect(result.instance?.value).toHaveLength(5000)
  })

  test('fails with PRODUCT_DESCRIPTION_TOO_LONG for 5001 characters', () => {
    const result = ProductDescription.tryCreate('a'.repeat(5001), {
      optional: true,
    })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['PRODUCT_DESCRIPTION_TOO_LONG'])
  })

  test('trims the value', () => {
    const result = ProductDescription.tryCreate('  Borracha macia  ', {
      optional: true,
    })

    expect(result.instance?.value).toBe('Borracha macia')
  })
})
