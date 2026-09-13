import { GeoPoint, GeoPointProps } from '../../src/store'

const valid = { latitude: -3.7356, longitude: -38.5012 }

describe('GeoPoint', () => {
  test('creates with valid coordinates', () => {
    const result = GeoPoint.tryCreate(valid)

    expect(result.isOk).toBe(true)
    expect(result.instance.latitude).toBe(-3.7356)
    expect(result.instance.longitude).toBe(-38.5012)
  })

  test('accepts the limits of both ranges', () => {
    expect(GeoPoint.tryCreate({ latitude: 90, longitude: 180 }).isOk).toBe(true)
    expect(GeoPoint.tryCreate({ latitude: -90, longitude: -180 }).isOk).toBe(
      true,
    )
  })

  test.each([91, -91])(
    'fails with GEO_POINT_LATITUDE_INVALID for latitude %p',
    (latitude) => {
      const result = GeoPoint.tryCreate({ ...valid, latitude })

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['GEO_POINT_LATITUDE_INVALID'])
    },
  )

  test.each([181, -181])(
    'fails with GEO_POINT_LONGITUDE_INVALID for longitude %p',
    (longitude) => {
      const result = GeoPoint.tryCreate({ ...valid, longitude })

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['GEO_POINT_LONGITUDE_INVALID'])
    },
  )

  test('fails with both codes when latitude and longitude are missing', () => {
    const result = GeoPoint.tryCreate({} as GeoPointProps)

    expect(result.errors).toEqual([
      'GEO_POINT_LATITUDE_INVALID',
      'GEO_POINT_LONGITUDE_INVALID',
    ])
  })

  test.each([Number.NaN, Number.POSITIVE_INFINITY, '-3.7' as unknown as number])(
    'fails for the non-finite or non-number latitude %p',
    (latitude) => {
      const result = GeoPoint.tryCreate({ ...valid, latitude })

      expect(result.errors).toEqual(['GEO_POINT_LATITUDE_INVALID'])
    },
  )

  test('rounds both coordinates to 6 decimal places', () => {
    const point = GeoPoint.create({
      latitude: -3.73561234,
      longitude: -38.50129876,
    })

    expect(point.latitude).toBe(-3.735612)
    expect(point.longitude).toBe(-38.501299)
  })

  test('equals compares both coordinates after rounding', () => {
    const point = GeoPoint.create(valid)

    expect(
      point.equals(GeoPoint.create({ latitude: -3.7356000001, longitude: -38.5012 })),
    ).toBe(true)
    expect(point.equals(GeoPoint.create({ ...valid, longitude: -38.5 }))).toBe(
      false,
    )
  })

  test('toProps returns a copy of the coordinates', () => {
    expect(GeoPoint.create(valid).toProps()).toEqual(valid)
  })

  test('create throws on invalid props', () => {
    expect(() => GeoPoint.create({ ...valid, latitude: 91 })).toThrow()
  })
})
