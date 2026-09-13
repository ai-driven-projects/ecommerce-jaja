import { Customer } from '../../src/customer'
import { InMemoryCustomerRepository } from './in-memory-customer.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'
const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const otherUserId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const cpf = '52998224725'
const otherCpf = '11144477735'

function customer(overrides: Partial<Parameters<typeof Customer.create>[0]> = {}) {
  return Customer.create({
    id,
    userId,
    cpf,
    phone: '85998765432',
    address: {
      zipCode: '60150160',
      street: 'Av. Santos Dumont',
      number: '1500',
      neighborhood: 'Aldeota',
      city: 'Fortaleza',
      state: 'CE',
    },
    ...overrides,
  })
}

async function setup() {
  const repository = new InMemoryCustomerRepository()
  await repository.create(customer())
  return repository
}

describe('InMemoryCustomerRepository', () => {
  test('finds a stored customer by id, userId and cpf', async () => {
    const repository = await setup()

    expect((await repository.findById(id)).instance.id).toBe(id)
    expect((await repository.findByUserId(userId)).instance?.id).toBe(id)
    expect((await repository.findByCpf(cpf)).instance?.id).toBe(id)
  })

  test('resolves userId and cpf lookups to null when missing', async () => {
    const repository = await setup()

    expect((await repository.findByUserId(otherUserId)).instance).toBeNull()
    expect((await repository.findByCpf(otherCpf)).instance).toBeNull()
  })

  test('fails findById with CUSTOMER_NOT_FOUND when missing', async () => {
    const repository = new InMemoryCustomerRepository()

    expect((await repository.findById(id)).errors).toEqual(['CUSTOMER_NOT_FOUND'])
  })

  test('fails create with CUSTOMER_NOT_FOUND for an existing id', async () => {
    const repository = await setup()

    const result = await repository.create(
      customer({ userId: otherUserId, cpf: otherCpf }),
    )

    expect(result.errors).toEqual(['CUSTOMER_NOT_FOUND'])
  })

  test('fails create with CUSTOMER_ALREADY_EXISTS for a used userId', async () => {
    const repository = await setup()

    const result = await repository.create(
      customer({ id: undefined, cpf: otherCpf }),
    )

    expect(result.errors).toEqual(['CUSTOMER_ALREADY_EXISTS'])
    expect(repository.size).toBe(1)
  })

  test('fails create and update with CUSTOMER_CPF_ALREADY_EXISTS for the CPF of another customer', async () => {
    const repository = await setup()
    const other = customer({ id: undefined, userId: otherUserId, cpf: otherCpf })
    await repository.create(other)

    expect(
      (await repository.create(customer({ id: undefined, userId: '11111111-2222-4333-8444-555555555555' })))
        .errors,
    ).toEqual(['CUSTOMER_CPF_ALREADY_EXISTS'])
    expect(
      (await repository.update(other.cloneWith({ cpf }).instance)).errors,
    ).toEqual(['CUSTOMER_CPF_ALREADY_EXISTS'])
  })

  test('fails update and delete with CUSTOMER_NOT_FOUND for a missing customer', async () => {
    const repository = new InMemoryCustomerRepository()

    expect((await repository.update(customer())).errors).toEqual([
      'CUSTOMER_NOT_FOUND',
    ])
    expect((await repository.delete(id)).errors).toEqual(['CUSTOMER_NOT_FOUND'])
  })

  test('delete fills deletedAt and lookups ignore the deleted customer', async () => {
    const repository = await setup()

    expect((await repository.delete(id)).isOk).toBe(true)

    expect(repository.size).toBe(1)
    expect((await repository.findById(id)).errors).toEqual(['CUSTOMER_NOT_FOUND'])
    expect((await repository.findByUserId(userId)).instance).toBeNull()
    expect((await repository.findByCpf(cpf)).instance).toBeNull()
    expect((await repository.update(customer())).errors).toEqual([
      'CUSTOMER_NOT_FOUND',
    ])
    expect((await repository.delete(id)).errors).toEqual(['CUSTOMER_NOT_FOUND'])
  })

  test('keeps userId and cpf of a deleted customer reserved', async () => {
    const repository = await setup()
    await repository.delete(id)

    expect(
      (await repository.create(customer({ id: undefined, cpf: otherCpf }))).errors,
    ).toEqual(['CUSTOMER_ALREADY_EXISTS'])
    expect(
      (await repository.create(customer({ id: undefined, userId: otherUserId })))
        .errors,
    ).toEqual(['CUSTOMER_CPF_ALREADY_EXISTS'])
  })
})
