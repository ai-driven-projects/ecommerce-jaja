import { Store, StoreProps } from '../../src/store'

const id = '550e8400-e29b-41d4-a716-446655440000'
const point = { latitude: -3.7475, longitude: -38.4839 }
const valid = {
  name: 'Loja Aldeota',
  slug: 'loja-aldeota',
  phone: '8530001001',
  address: 'Rua Silva Paulet, 1100 – Aldeota, Fortaleza/CE',
  latitude: -3.7356,
  longitude: -38.5012,
  deliveryRadiusMeters: 2500,
  isActive: false,
}

describe('Store', () => {
  test('creates with valid attributes', () => {
    const result = Store.tryCreate({ ...valid, id })

    expect(result.isOk).toBe(true)
    const store = result.instance
    expect(store.id).toBe(id)
    expect(store.name).toBe('Loja Aldeota')
    expect(store.slug).toBe('loja-aldeota')
    expect(store.phone).toBe('8530001001')
    expect(store.address).toBe('Rua Silva Paulet, 1100 – Aldeota, Fortaleza/CE')
    expect(store.latitude).toBe(-3.7356)
    expect(store.longitude).toBe(-38.5012)
    expect(store.deliveryRadiusMeters).toBe(2500)
    expect(store.isActive).toBe(false)
  })

  test('defaults the radius to 1000 m, isActive to true and optional fields to null', () => {
    const store = Store.create({
      name: 'Loja Meireles',
      latitude: -3.7247,
      longitude: -38.4968,
    })

    expect(store.slug).toBe('loja-meireles')
    expect(store.deliveryRadiusMeters).toBe(1000)
    expect(store.isActive).toBe(true)
    expect(store.phone).toBeNull()
    expect(store.address).toBeNull()
  })

  test('derives the slug from the name when it is missing', () => {
    const store = Store.create({ name: 'Loja Cocó', ...point })

    expect(store.slug).toBe('loja-coco')
  })

  test('stores only the digits of a masked phone', () => {
    const store = Store.create({ name: 'Loja Cocó', phone: '(85) 3000-1001', ...point })

    expect(store.phone).toBe('8530001001')
  })

  test('fails with PHONE_INVALID_LENGTH for a phone with 4 digits', () => {
    const result = Store.tryCreate({ name: 'Loja Cocó', phone: '9999', ...point })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['PHONE_INVALID_LENGTH'])
  })

  test('fails when the address has 201 characters', () => {
    const result = Store.tryCreate({
      name: 'Loja Cocó',
      address: 'a'.repeat(201),
      ...point,
    })

    expect(result.errors).toEqual(['TEXT_TOO_LONG'])
  })

  test('accepts an address with 200 characters', () => {
    const result = Store.tryCreate({
      name: 'Loja Cocó',
      address: 'a'.repeat(200),
      ...point,
    })

    expect(result.isOk).toBe(true)
  })

  test('turns an empty address into null', () => {
    const store = Store.create({ name: 'Loja Cocó', address: '', ...point })

    expect(store.address).toBeNull()
  })

  test('fails with both GeoPoint codes when the coordinates are missing', () => {
    const result = Store.tryCreate({ name: 'Loja Meireles' } as StoreProps)

    expect(result.errors).toEqual([
      'GEO_POINT_LATITUDE_INVALID',
      'GEO_POINT_LONGITUDE_INVALID',
    ])
  })

  test.each([91, -91])(
    'fails with GEO_POINT_LATITUDE_INVALID for latitude %p',
    (latitude) => {
      const result = Store.tryCreate({ ...valid, latitude })

      expect(result.errors).toEqual(['GEO_POINT_LATITUDE_INVALID'])
    },
  )

  test('fails with GEO_POINT_LONGITUDE_INVALID for longitude 181', () => {
    const result = Store.tryCreate({ ...valid, longitude: 181 })

    expect(result.errors).toEqual(['GEO_POINT_LONGITUDE_INVALID'])
  })

  test('rounds the coordinates to 6 decimal places', () => {
    const store = Store.create({
      name: 'Loja Aldeota',
      latitude: -3.73561234,
      longitude: -38.50129876,
    })

    expect(store.latitude).toBe(-3.735612)
    expect(store.longitude).toBe(-38.501299)
  })

  test.each([299, 10001, 1500.5])(
    'fails with DELIVERY_RADIUS_INVALID for %p meters',
    (deliveryRadiusMeters) => {
      const result = Store.tryCreate({ ...valid, deliveryRadiusMeters })

      expect(result.errors).toEqual(['DELIVERY_RADIUS_INVALID'])
    },
  )

  test('create throws on invalid props', () => {
    expect(() => Store.create({ name: 'A', ...point })).toThrow()
  })

  test('cloneWith revalidates the changed props', () => {
    const store = Store.create({ ...valid, id })

    expect(store.cloneWith({ name: 'Loja Aldeota Sul' }).instance.slug).toBe(
      'loja-aldeota',
    )
    expect(store.cloneWith({ latitude: 91 }).errors).toEqual([
      'GEO_POINT_LATITUDE_INVALID',
    ])
  })

  test('toDTO exposes exactly the public fields', () => {
    const store = Store.create({ name: 'Loja Cocó', id, ...point })
    const dto = store.toDTO()

    expect(Object.keys(dto).sort()).toEqual([
      'address',
      'createdAt',
      'deliveryRadiusMeters',
      'id',
      'isActive',
      'latitude',
      'longitude',
      'name',
      'phone',
      'slug',
      'updatedAt',
    ])
    expect(dto).toEqual({
      id,
      name: 'Loja Cocó',
      slug: 'loja-coco',
      phone: null,
      address: null,
      latitude: -3.7475,
      longitude: -38.4839,
      deliveryRadiusMeters: 1000,
      isActive: true,
      createdAt: store.createdAt,
      updatedAt: store.updatedAt,
    })
  })
})
