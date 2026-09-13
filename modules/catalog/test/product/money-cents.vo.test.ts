import { MoneyCents } from '../../src/product'

describe('MoneyCents', () => {
  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'fails with MONEY_CENTS_INVALID for %p',
    (value) => {
      const result = MoneyCents.tryCreate(value)

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['MONEY_CENTS_INVALID'])
    },
  )

  test('fails with MONEY_CENTS_INVALID for a non-number value', () => {
    const result = MoneyCents.tryCreate('390' as unknown as number)

    expect(result.errors).toEqual(['MONEY_CENTS_INVALID'])
  })

  test('accepts 1', () => {
    const result = MoneyCents.tryCreate(1)

    expect(result.isOk).toBe(true)
    expect(result.instance.value).toBe(1)
  })

  test('fails when required and missing', () => {
    const result = MoneyCents.tryCreate(undefined as unknown as number)

    expect(result.errors).toEqual(['MONEY_CENTS_INVALID'])
  })

  test('resolves to null when optional and missing', () => {
    expect(MoneyCents.tryCreate(null, { optional: true }).instance).toBeNull()
    expect(
      MoneyCents.tryCreate(undefined, { optional: true }).instance,
    ).toBeNull()
  })

  test('fails when optional but NaN', () => {
    const result = MoneyCents.tryCreate(Number.NaN, { optional: true })

    expect(result.errors).toEqual(['MONEY_CENTS_INVALID'])
  })

  test('create throws on an invalid value', () => {
    expect(() => MoneyCents.create(0)).toThrow()
  })
})
