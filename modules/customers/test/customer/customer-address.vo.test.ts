import { CustomerAddress } from '../../src/customer'

const valid = {
  zipCode: '60150-160',
  street: 'Av. Santos Dumont',
  number: '1500',
  complement: 'Torre B',
  neighborhood: 'Aldeota',
  city: 'Fortaleza',
  state: 'ce',
}

describe('CustomerAddress', () => {
  test('creates with valid attributes, normalizing zip code and state', () => {
    const result = CustomerAddress.tryCreate(valid)

    expect(result.isOk).toBe(true)
    const address = result.instance
    expect(address.zipCode).toBe('60150160')
    expect(address.street).toBe('Av. Santos Dumont')
    expect(address.number).toBe('1500')
    expect(address.complement).toBe('Torre B')
    expect(address.neighborhood).toBe('Aldeota')
    expect(address.city).toBe('Fortaleza')
    expect(address.state).toBe('CE')
  })

  test('trims the texts', () => {
    const address = CustomerAddress.create({
      ...valid,
      street: '  Rua Silva Paulet  ',
      complement: '  Apto 302 ',
    })

    expect(address.street).toBe('Rua Silva Paulet')
    expect(address.complement).toBe('Apto 302')
  })

  test.each(['street', 'number', 'neighborhood', 'city'] as const)(
    'fails with TEXT_TOO_SHORT when %s is blank',
    (field) => {
      const result = CustomerAddress.tryCreate({ ...valid, [field]: '   ' })

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['TEXT_TOO_SHORT'])
    },
  )

  test('fails with CUSTOMER_ZIP_CODE_INVALID when zipCode is blank', () => {
    const result = CustomerAddress.tryCreate({ ...valid, zipCode: '' })

    expect(result.errors).toEqual(['CUSTOMER_ZIP_CODE_INVALID'])
  })

  test('fails with CUSTOMER_STATE_INVALID when state is blank', () => {
    const result = CustomerAddress.tryCreate({ ...valid, state: '' })

    expect(result.errors).toEqual(['CUSTOMER_STATE_INVALID'])
  })

  test('combines the errors of every missing attribute', () => {
    const result = CustomerAddress.tryCreate(
      undefined as unknown as typeof valid,
    )

    expect(result.errors).toEqual([
      'CUSTOMER_ZIP_CODE_INVALID',
      'TEXT_TOO_SHORT',
      'TEXT_TOO_SHORT',
      'TEXT_TOO_SHORT',
      'TEXT_TOO_SHORT',
      'CUSTOMER_STATE_INVALID',
    ])
  })

  test('fails with TEXT_TOO_SHORT for a street with 1 character', () => {
    const result = CustomerAddress.tryCreate({ ...valid, street: 'R' })

    expect(result.errors).toEqual(['TEXT_TOO_SHORT'])
  })

  test('accepts a street with 120 characters', () => {
    const result = CustomerAddress.tryCreate({ ...valid, street: 'a'.repeat(120) })

    expect(result.isOk).toBe(true)
  })

  test('fails with TEXT_TOO_LONG for a street with 121 characters', () => {
    const result = CustomerAddress.tryCreate({ ...valid, street: 'a'.repeat(121) })

    expect(result.errors).toEqual(['TEXT_TOO_LONG'])
  })

  test('accepts "S/N" as number', () => {
    const result = CustomerAddress.tryCreate({ ...valid, number: 'S/N' })

    expect(result.isOk).toBe(true)
    expect(result.instance.number).toBe('S/N')
  })

  test('accepts a number with 1 character and fails with 11', () => {
    expect(CustomerAddress.tryCreate({ ...valid, number: '7' }).isOk).toBe(true)
    expect(
      CustomerAddress.tryCreate({ ...valid, number: '1'.repeat(11) }).errors,
    ).toEqual(['TEXT_TOO_LONG'])
  })

  test('fails with TEXT_TOO_LONG for a complement with 81 characters', () => {
    expect(
      CustomerAddress.tryCreate({ ...valid, complement: 'a'.repeat(80) }).isOk,
    ).toBe(true)
    expect(
      CustomerAddress.tryCreate({ ...valid, complement: 'a'.repeat(81) }).errors,
    ).toEqual(['TEXT_TOO_LONG'])
  })

  test.each(['neighborhood', 'city'] as const)(
    'accepts %s with 60 characters and fails with 61',
    (field) => {
      expect(
        CustomerAddress.tryCreate({ ...valid, [field]: 'a'.repeat(60) }).isOk,
      ).toBe(true)
      expect(
        CustomerAddress.tryCreate({ ...valid, [field]: 'a'.repeat(61) }).errors,
      ).toEqual(['TEXT_TOO_LONG'])
    },
  )

  test.each(['', '   ', null, undefined])(
    'resolves complement %p to null',
    (complement) => {
      const result = CustomerAddress.tryCreate({ ...valid, complement })

      expect(result.isOk).toBe(true)
      expect(result.instance.complement).toBeNull()
    },
  )

  test('toDTO exposes exactly the normalized fields', () => {
    const dto = CustomerAddress.create({ ...valid, complement: '' }).toDTO()

    expect(dto).toEqual({
      zipCode: '60150160',
      street: 'Av. Santos Dumont',
      number: '1500',
      complement: null,
      neighborhood: 'Aldeota',
      city: 'Fortaleza',
      state: 'CE',
    })
  })

  test('equals compares every attribute', () => {
    const address = CustomerAddress.create(valid)

    expect(address.equals(CustomerAddress.create({ ...valid, zipCode: '60150160' }))).toBe(true)
    expect(address.equals(CustomerAddress.create({ ...valid, number: '1501' }))).toBe(false)
  })

  test('create throws on invalid props', () => {
    expect(() => CustomerAddress.create({ ...valid, state: 'XX' })).toThrow()
  })
})
