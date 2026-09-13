import { ZipCode } from '../../src/customer'

describe('ZipCode', () => {
  test('accepts a zip code with a dash and keeps the 8 digits', () => {
    const result = ZipCode.tryCreate('60150-160')

    expect(result.isOk).toBe(true)
    expect(result.instance.value).toBe('60150160')
  })

  test('accepts a zip code with only digits', () => {
    const result = ZipCode.tryCreate('60150160')

    expect(result.isOk).toBe(true)
    expect(result.instance.value).toBe('60150160')
  })

  test('trims the value', () => {
    expect(ZipCode.create('  60150-160  ').value).toBe('60150160')
  })

  test.each(['6015A-160', 'abcdefgh', '6015016', '6015-160', '601501601', '60150 160', ''])(
    'fails with CUSTOMER_ZIP_CODE_INVALID for %p',
    (value) => {
      const result = ZipCode.tryCreate(value)

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['CUSTOMER_ZIP_CODE_INVALID'])
    },
  )

  test('fails with CUSTOMER_ZIP_CODE_INVALID for a non-string value', () => {
    const result = ZipCode.tryCreate(60150160 as unknown as string)

    expect(result.errors).toEqual(['CUSTOMER_ZIP_CODE_INVALID'])
  })

  test('formatted returns the zip code with a dash', () => {
    expect(ZipCode.create('60150160').formatted).toBe('60150-160')
  })

  test('create throws on an invalid value', () => {
    expect(() => ZipCode.create('6015016')).toThrow()
  })
})
