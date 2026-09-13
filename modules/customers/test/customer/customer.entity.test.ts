import { Customer } from '../../src/customer'

const id = '550e8400-e29b-41d4-a716-446655440000'
const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const address = {
  zipCode: '60150-160',
  street: 'Av. Santos Dumont',
  number: '1500',
  complement: 'Torre B',
  neighborhood: 'Aldeota',
  city: 'Fortaleza',
  state: 'ce',
}
const valid = {
  userId,
  cpf: '52998224725',
  phone: '85998765432',
  address,
}

describe('Customer', () => {
  test('creates with valid attributes', () => {
    const result = Customer.tryCreate({ ...valid, id, isActive: false })

    expect(result.isOk).toBe(true)
    const customer = result.instance
    expect(customer.id).toBe(id)
    expect(customer.userId).toBe(userId)
    expect(customer.cpf).toBe('52998224725')
    expect(customer.phone).toBe('85998765432')
    expect(customer.address).toEqual({
      zipCode: '60150160',
      street: 'Av. Santos Dumont',
      number: '1500',
      complement: 'Torre B',
      neighborhood: 'Aldeota',
      city: 'Fortaleza',
      state: 'CE',
    })
    expect(customer.isActive).toBe(false)
  })

  test('normalizes a masked CPF and phone to digits', () => {
    const customer = Customer.create({
      ...valid,
      cpf: '529.982.247-25',
      phone: '(85) 99876-5432',
    })

    expect(customer.cpf).toBe('52998224725')
    expect(customer.phone).toBe('85998765432')
  })

  test('defaults isActive to true and generates the id', () => {
    const customer = Customer.create(valid)

    expect(customer.isActive).toBe(true)
    expect(customer.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  test('stores a blank complement as null', () => {
    const customer = Customer.create({
      ...valid,
      address: { ...address, complement: '' },
    })

    expect(customer.address.complement).toBeNull()
  })

  test('fails with CPF_INVALID_CHECK_DIGIT for a wrong check digit', () => {
    const result = Customer.tryCreate({ ...valid, cpf: '529.982.247-26' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['CPF_INVALID_CHECK_DIGIT'])
  })

  test('fails with CPF_REPEATED_SEQUENCE for a repeated digit', () => {
    const result = Customer.tryCreate({ ...valid, cpf: '111.111.111-11' })

    expect(result.errors).toEqual(['CPF_REPEATED_SEQUENCE'])
  })

  test('fails with PHONE_INVALID_LENGTH for a short phone', () => {
    const result = Customer.tryCreate({ ...valid, phone: '9999' })

    expect(result.errors).toEqual(['PHONE_INVALID_LENGTH'])
  })

  test('fails with INVALID_ID for a malformed userId', () => {
    const result = Customer.tryCreate({ ...valid, userId: 'abc' })

    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails with INVALID_ID for a missing userId', () => {
    const result = Customer.tryCreate({
      ...valid,
      userId: undefined as unknown as string,
    })

    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails with the address errors for an invalid address', () => {
    const result = Customer.tryCreate({
      ...valid,
      address: { ...address, zipCode: '6015-160', state: 'XX' },
    })

    expect(result.errors).toEqual([
      'CUSTOMER_ZIP_CODE_INVALID',
      'CUSTOMER_STATE_INVALID',
    ])
  })

  test('fails when the address is missing', () => {
    const result = Customer.tryCreate({
      ...valid,
      address: undefined as unknown as typeof address,
    })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toContain('CUSTOMER_ZIP_CODE_INVALID')
  })

  test('combines the errors of every invalid attribute', () => {
    const result = Customer.tryCreate({
      userId: 'abc',
      cpf: '111.111.111-11',
      phone: '9999',
      address: { ...address, street: '' },
    })

    expect(result.errors).toEqual([
      'INVALID_ID',
      'CPF_REPEATED_SEQUENCE',
      'PHONE_INVALID_LENGTH',
      'TEXT_TOO_SHORT',
    ])
  })

  test('create throws on invalid props', () => {
    expect(() => Customer.create({ ...valid, cpf: '123' })).toThrow()
  })

  test('cloneWith replaces the address and revalidates it', () => {
    const customer = Customer.create({ ...valid, id })

    const moved = customer.cloneWith({
      address: {
        zipCode: '60160-230',
        street: 'Rua Silva Paulet',
        number: 'S/N',
        complement: null,
        neighborhood: 'Meireles',
        city: 'Fortaleza',
        state: 'CE',
      },
    })

    expect(moved.instance.id).toBe(id)
    expect(moved.instance.userId).toBe(userId)
    expect(moved.instance.address).toMatchObject({
      zipCode: '60160230',
      number: 'S/N',
      complement: null,
      neighborhood: 'Meireles',
    })
    expect(customer.cloneWith({ phone: '9999' }).errors).toEqual([
      'PHONE_INVALID_LENGTH',
    ])
  })

  test('equals compares by id', () => {
    const customer = Customer.create({ ...valid, id })

    expect(customer.equals(Customer.create({ ...valid, id }))).toBe(true)
    expect(customer.notEquals(Customer.create(valid))).toBe(true)
  })

  test('toDTO exposes exactly the public fields', () => {
    const customer = Customer.create({ ...valid, id })
    const dto = customer.toDTO()

    expect(Object.keys(dto).sort()).toEqual([
      'address',
      'cpf',
      'createdAt',
      'id',
      'isActive',
      'phone',
      'updatedAt',
      'userId',
    ])
    expect(dto).toEqual({
      id,
      userId,
      cpf: '52998224725',
      phone: '85998765432',
      address: {
        zipCode: '60150160',
        street: 'Av. Santos Dumont',
        number: '1500',
        complement: 'Torre B',
        neighborhood: 'Aldeota',
        city: 'Fortaleza',
        state: 'CE',
      },
      isActive: true,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    })
  })
})
