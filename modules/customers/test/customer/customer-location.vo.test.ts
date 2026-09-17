import { CustomerLocation, CustomerLocationProps } from '../../src/customer'

const valid = { latitude: -23.561414, longitude: -46.655881 }

describe('CustomerLocation', () => {
  test('creates with valid coordinates', () => {
    const result = CustomerLocation.tryCreate(valid)

    expect(result.isOk).toBe(true)
    expect(result.instance.latitude).toBe(-23.561414)
    expect(result.instance.longitude).toBe(-46.655881)
  })

  test.each([
    { latitude: 90, longitude: 180 },
    { latitude: -90, longitude: -180 },
    { latitude: -90, longitude: 180 },
    { latitude: 90, longitude: -180 },
  ])('accepts the limits %p', (props) => {
    const result = CustomerLocation.tryCreate(props)

    expect(result.isOk).toBe(true)
    expect(result.instance.toDTO()).toEqual(props)
  })

  test.each([
    { latitude: 90.000001, longitude: 0 },
    { latitude: -90.000001, longitude: 0 },
    { latitude: 0, longitude: 180.000001 },
    { latitude: 0, longitude: -180.5 },
    { latitude: 91, longitude: 181 },
  ])('fails with CUSTOMER_LOCATION_INVALID out of range %p', (props) => {
    const result = CustomerLocation.tryCreate(props)

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['CUSTOMER_LOCATION_INVALID'])
  })

  test.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    '-23.56',
    null,
    undefined,
  ])('fails with CUSTOMER_LOCATION_INVALID for latitude %p', (latitude) => {
    const result = CustomerLocation.tryCreate({
      ...valid,
      latitude: latitude as number,
    })

    expect(result.errors).toEqual(['CUSTOMER_LOCATION_INVALID'])
  })

  test.each([Number.NaN, Number.NEGATIVE_INFINITY, 'abc', null, undefined])(
    'fails with CUSTOMER_LOCATION_INVALID for longitude %p',
    (longitude) => {
      const result = CustomerLocation.tryCreate({
        ...valid,
        longitude: longitude as number,
      })

      expect(result.errors).toEqual(['CUSTOMER_LOCATION_INVALID'])
    },
  )

  test('fails with a single code when both coordinates are missing', () => {
    const result = CustomerLocation.tryCreate({} as CustomerLocationProps)

    expect(result.errors).toEqual(['CUSTOMER_LOCATION_INVALID'])
  })

  test.each([null, undefined, 'abc', 42])(
    'fails with CUSTOMER_LOCATION_INVALID for the props %p',
    (props) => {
      const result = CustomerLocation.tryCreate(
        props as unknown as CustomerLocationProps,
      )

      expect(result.errors).toEqual(['CUSTOMER_LOCATION_INVALID'])
    },
  )

  test('rounds both coordinates to 6 decimal places', () => {
    const location = CustomerLocation.create({
      latitude: -23.5614141234,
      longitude: -46.6558809876,
    })

    expect(location.latitude).toBe(-23.561414)
    expect(location.longitude).toBe(-46.655881)
  })

  test('turns -0 into 0, also after rounding', () => {
    const location = CustomerLocation.create({
      latitude: -0,
      longitude: -0.0000001,
    })

    expect(Object.is(location.latitude, 0)).toBe(true)
    expect(Object.is(location.longitude, 0)).toBe(true)
  })

  test('equals compares both coordinates after rounding', () => {
    const location = CustomerLocation.create(valid)

    expect(
      location.equals(
        CustomerLocation.create({ ...valid, latitude: -23.5614140001 }),
      ),
    ).toBe(true)
    expect(
      location.equals(CustomerLocation.create({ ...valid, longitude: -46.65 })),
    ).toBe(false)
  })

  test('toDTO returns a copy of the coordinates', () => {
    const location = CustomerLocation.create(valid)
    const dto = location.toDTO()
    dto.latitude = 0

    expect(location.toDTO()).toEqual(valid)
  })

  test('create throws on invalid props', () => {
    expect(() => CustomerLocation.create({ ...valid, latitude: 91 })).toThrow()
  })
})
