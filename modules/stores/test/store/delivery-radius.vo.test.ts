import { DeliveryRadius } from '../../src/store'

describe('DeliveryRadius', () => {
  test.each([300, 1000, 10000])('accepts %p meters', (value) => {
    const result = DeliveryRadius.tryCreate(value)

    expect(result.isOk).toBe(true)
    expect(result.instance.value).toBe(value)
  })

  test.each([299, 10001, 1500.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'fails with DELIVERY_RADIUS_INVALID for %p',
    (value) => {
      const result = DeliveryRadius.tryCreate(value)

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['DELIVERY_RADIUS_INVALID'])
    },
  )

  test('fails with DELIVERY_RADIUS_INVALID for a missing or non-number value', () => {
    expect(
      DeliveryRadius.tryCreate(undefined as unknown as number).errors,
    ).toEqual(['DELIVERY_RADIUS_INVALID'])
    expect(DeliveryRadius.tryCreate('1000' as unknown as number).errors).toEqual(
      ['DELIVERY_RADIUS_INVALID'],
    )
  })

  test('create throws on an invalid value', () => {
    expect(() => DeliveryRadius.create(299)).toThrow()
  })
})
