import { Id, Result } from '@mentoria-360/shared'
import { Customer, SaveCustomer, SaveCustomerInput } from '../../src/customer'
import { InMemoryCustomerRepository } from '../mock/in-memory-customer.repository'

const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const otherUserId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const missingId = '550e8400-e29b-41d4-a716-446655440000'
const cpf = '52998224725'
const otherCpf = '11144477735'

const address = {
  zipCode: '60150-160',
  street: 'Av. Santos Dumont',
  number: '1500',
  complement: 'Torre B',
  neighborhood: 'Aldeota',
  city: 'Fortaleza',
  state: 'ce',
}

function input(overrides: Partial<SaveCustomerInput> = {}): SaveCustomerInput {
  return {
    userId,
    cpf: '529.982.247-25',
    phone: '(85) 99876-5432',
    address,
    ...overrides,
  }
}

function setup() {
  const repository = new InMemoryCustomerRepository()
  const useCase = new SaveCustomer(repository)
  return { repository, useCase }
}

async function createCustomer(
  useCase: SaveCustomer,
  overrides: Partial<SaveCustomerInput> = {},
) {
  const result = await useCase.execute(input(overrides))
  return result.instance
}

describe('SaveCustomer', () => {
  describe('without id (the user)', () => {
    test('creates a customer for the userId, normalizing the data', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute(
        input({ address: { ...address, complement: '' } }),
      )

      expect(result.isOk).toBe(true)
      const dto = result.instance
      expect(Id.isValid(dto.id)).toBe(true)
      expect(dto).toMatchObject({
        userId,
        cpf,
        phone: '85998765432',
        address: {
          zipCode: '60150160',
          street: 'Av. Santos Dumont',
          number: '1500',
          complement: null,
          neighborhood: 'Aldeota',
          city: 'Fortaleza',
          state: 'CE',
        },
        isActive: true,
      })
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
      const stored = await repository.findByUserId(userId)
      expect(stored.instance?.id).toBe(dto.id)
    })

    test('updates the same customer on a second call with the same userId', async () => {
      const { repository, useCase } = setup()
      const created = await createCustomer(useCase)
      const create = jest.spyOn(repository, 'create')
      await new Promise((resolve) => setTimeout(resolve, 5))

      const result = await useCase.execute(
        input({
          phone: '85912345678',
          address: {
            zipCode: '60160230',
            street: 'Rua Silva Paulet',
            number: 'S/N',
            neighborhood: 'Meireles',
            city: 'Fortaleza',
            state: 'CE',
          },
        }),
      )

      expect(result.isOk).toBe(true)
      expect(result.instance).toMatchObject({
        id: created.id,
        userId,
        phone: '85912345678',
        address: {
          zipCode: '60160230',
          street: 'Rua Silva Paulet',
          number: 'S/N',
          complement: null,
          neighborhood: 'Meireles',
        },
      })
      expect(result.instance.createdAt).toEqual(created.createdAt)
      expect(result.instance.updatedAt.getTime()).toBeGreaterThan(
        created.updatedAt.getTime(),
      )
      expect(create).not.toHaveBeenCalled()
      expect(repository.size).toBe(1)
      expect((await repository.findById(created.id)).instance.phone).toBe(
        '85912345678',
      )
    })

    test.each([undefined, '', 'abc'])(
      'fails with INVALID_ID for userId %p and stores nothing',
      async (value) => {
        const { repository, useCase } = setup()

        const result = await useCase.execute(input({ userId: value }))

        expect(result.errors).toEqual(['INVALID_ID'])
        expect(repository.size).toBe(0)
      },
    )

    test('ignores isActive: false on creation', async () => {
      const { useCase } = setup()

      const result = await useCase.execute(input({ isActive: false }))

      expect(result.instance.isActive).toBe(true)
    })

    test('does not reactivate a customer deactivated by the administration', async () => {
      const { repository, useCase } = setup()
      const created = await createCustomer(useCase)
      await useCase.execute(input({ id: created.id, isActive: false }))

      const result = await useCase.execute(input({ isActive: true }))

      expect(result.isOk).toBe(true)
      expect(result.instance.isActive).toBe(false)
      expect((await repository.findById(created.id)).instance.isActive).toBe(
        false,
      )
    })

    test('fails with CUSTOMER_CPF_ALREADY_EXISTS on creation with the CPF of another customer in another mask', async () => {
      const { repository, useCase } = setup()
      await createCustomer(useCase, { cpf })
      const create = jest.spyOn(repository, 'create')

      const result = await useCase.execute(
        input({ userId: otherUserId, cpf: '529.982.247-25' }),
      )

      expect(result.errors).toEqual(['CUSTOMER_CPF_ALREADY_EXISTS'])
      expect(create).not.toHaveBeenCalled()
      expect(repository.size).toBe(1)
      expect((await repository.findByUserId(otherUserId)).instance).toBeNull()
    })

    test('fails with CUSTOMER_CPF_ALREADY_EXISTS on update with the CPF of another customer', async () => {
      const { repository, useCase } = setup()
      await createCustomer(useCase)
      const other = await createCustomer(useCase, {
        userId: otherUserId,
        cpf: otherCpf,
      })

      const result = await useCase.execute(
        input({ userId: otherUserId, cpf: '52998224725' }),
      )

      expect(result.errors).toEqual(['CUSTOMER_CPF_ALREADY_EXISTS'])
      expect((await repository.findById(other.id)).instance.cpf).toBe(otherCpf)
    })

    test('accepts its own CPF in another mask', async () => {
      const { repository, useCase } = setup()
      const created = await createCustomer(useCase, { cpf })

      const result = await useCase.execute(
        input({ cpf: '529.982.247-25', phone: '85912345678' }),
      )

      expect(result.isOk).toBe(true)
      expect(result.instance).toMatchObject({
        id: created.id,
        cpf,
        phone: '85912345678',
      })
      expect(repository.size).toBe(1)
    })

    test('stops at an invalid CPF before looking it up', async () => {
      const { repository, useCase } = setup()
      const findByCpf = jest.spyOn(repository, 'findByCpf')

      const result = await useCase.execute(input({ cpf: '529.982.247-26' }))

      expect(result.errors).toEqual(['CPF_INVALID_CHECK_DIGIT'])
      expect(findByCpf).not.toHaveBeenCalled()
      expect(repository.size).toBe(0)
    })

    test('fails with CPF_REPEATED_SEQUENCE for a repeated digit', async () => {
      const { useCase } = setup()

      const result = await useCase.execute(input({ cpf: '111.111.111-11' }))

      expect(result.errors).toEqual(['CPF_REPEATED_SEQUENCE'])
    })

    test('fails with the validation errors and stores nothing', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute(
        input({
          phone: '9999',
          address: { ...address, zipCode: '6015-160', state: 'XX' },
        }),
      )

      expect(result.errors).toEqual([
        'PHONE_INVALID_LENGTH',
        'CUSTOMER_ZIP_CODE_INVALID',
        'CUSTOMER_STATE_INVALID',
      ])
      expect(repository.size).toBe(0)
    })

    test('keeps the CPF of a deleted customer reserved', async () => {
      const { repository, useCase } = setup()
      const created = await createCustomer(useCase, { cpf })
      await repository.delete(created.id)

      const result = await useCase.execute(
        input({ userId: otherUserId, cpf }),
      )

      expect(result.errors).toEqual(['CUSTOMER_CPF_ALREADY_EXISTS'])
      expect(repository.size).toBe(1)
    })

    test('propagates a findByUserId failure', async () => {
      const { repository, useCase } = setup()
      jest
        .spyOn(repository, 'findByUserId')
        .mockResolvedValue(Result.fail('DB_ERROR'))

      const result = await useCase.execute(input())

      expect(result.errors).toEqual(['DB_ERROR'])
      expect(repository.size).toBe(0)
    })

    test('propagates a findByCpf failure', async () => {
      const { repository, useCase } = setup()
      jest
        .spyOn(repository, 'findByCpf')
        .mockResolvedValue(Result.fail('DB_ERROR'))

      const result = await useCase.execute(input())

      expect(result.errors).toEqual(['DB_ERROR'])
      expect(repository.size).toBe(0)
    })

    test('propagates a create failure', async () => {
      const { repository, useCase } = setup()
      jest
        .spyOn(repository, 'create')
        .mockResolvedValue(Result.fail('CUSTOMER_ALREADY_EXISTS'))

      const result = await useCase.execute(input())

      expect(result.errors).toEqual(['CUSTOMER_ALREADY_EXISTS'])
    })
  })

  describe('with id (the administration)', () => {
    test('updates the customer applying isActive', async () => {
      const { repository, useCase } = setup()
      const created = await createCustomer(useCase)

      const result = await useCase.execute(
        input({ id: created.id, userId: undefined, isActive: false }),
      )

      expect(result.isOk).toBe(true)
      expect(result.instance).toMatchObject({ id: created.id, isActive: false })
      expect((await repository.findById(created.id)).instance.isActive).toBe(
        false,
      )

      const reactivated = await useCase.execute(
        input({ id: created.id, isActive: true }),
      )
      expect(reactivated.instance.isActive).toBe(true)
    })

    test('keeps the current isActive when it is not sent', async () => {
      const { useCase } = setup()
      const created = await createCustomer(useCase)
      await useCase.execute(input({ id: created.id, isActive: false }))

      const result = await useCase.execute(input({ id: created.id }))

      expect(result.instance.isActive).toBe(false)
    })

    test('replaces the whole address', async () => {
      const { useCase } = setup()
      const created = await createCustomer(useCase)

      const result = await useCase.execute(
        input({
          id: created.id,
          address: {
            zipCode: '60160230',
            street: 'Rua Silva Paulet',
            number: '10',
            complement: null,
            neighborhood: 'Meireles',
            city: 'Fortaleza',
            state: 'CE',
          },
        }),
      )

      expect(result.instance.address).toEqual({
        zipCode: '60160230',
        street: 'Rua Silva Paulet',
        number: '10',
        complement: null,
        neighborhood: 'Meireles',
        city: 'Fortaleza',
        state: 'CE',
      })
    })

    test('fails validation instead of keeping a missing required field', async () => {
      const { repository, useCase } = setup()
      const created = await createCustomer(useCase)

      const result = await useCase.execute({
        id: created.id,
        cpf,
        phone: undefined as unknown as string,
        address: { ...address, street: undefined as unknown as string },
      })

      expect(result.errors).toEqual(['PHONE_INVALID_FORMAT', 'TEXT_TOO_SHORT'])
      expect((await repository.findById(created.id)).instance.address.street).toBe(
        'Av. Santos Dumont',
      )
    })

    test('fails with CUSTOMER_NOT_FOUND for an unknown id and creates nothing', async () => {
      const { repository, useCase } = setup()
      const create = jest.spyOn(repository, 'create')
      const update = jest.spyOn(repository, 'update')

      const result = await useCase.execute(input({ id: missingId }))

      expect(result.errors).toEqual(['CUSTOMER_NOT_FOUND'])
      expect(create).not.toHaveBeenCalled()
      expect(update).not.toHaveBeenCalled()
      expect(repository.size).toBe(0)
      expect((await repository.findByUserId(userId)).instance).toBeNull()
    })

    test('fails with CUSTOMER_NOT_FOUND for the id of a deleted customer', async () => {
      const { repository, useCase } = setup()
      const created = await createCustomer(useCase)
      await repository.delete(created.id)

      const result = await useCase.execute(input({ id: created.id }))

      expect(result.errors).toEqual(['CUSTOMER_NOT_FOUND'])
    })

    test('fails with INVALID_ID for a malformed id', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute(input({ id: 'abc' }))

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(repository.size).toBe(0)
    })

    test('does not change the userId link when userId is sent', async () => {
      const { repository, useCase } = setup()
      const created = await createCustomer(useCase)

      const result = await useCase.execute(
        input({ id: created.id, userId: otherUserId }),
      )

      expect(result.isOk).toBe(true)
      expect(result.instance.userId).toBe(userId)
      expect((await repository.findById(created.id)).instance.userId).toBe(
        userId,
      )
      expect((await repository.findByUserId(otherUserId)).instance).toBeNull()
    })

    test('fails with CUSTOMER_CPF_ALREADY_EXISTS for the CPF of another customer and changes neither', async () => {
      const { repository, useCase } = setup()
      const first = await createCustomer(useCase, { cpf })
      const second = await createCustomer(useCase, {
        userId: otherUserId,
        cpf: otherCpf,
      })

      const result = await useCase.execute(
        input({ id: second.id, cpf: '529.982.247-25', phone: '85912345678' }),
      )

      expect(result.errors).toEqual(['CUSTOMER_CPF_ALREADY_EXISTS'])
      const stored = (await repository.findById(second.id)).instance
      expect(stored.cpf).toBe(otherCpf)
      expect(stored.phone).toBe('85998765432')
      expect((await repository.findById(first.id)).instance.cpf).toBe(cpf)
    })

    test('accepts its own CPF', async () => {
      const { useCase } = setup()
      const created = await createCustomer(useCase, { cpf })

      const result = await useCase.execute(
        input({ id: created.id, cpf: '529.982.247-25' }),
      )

      expect(result.isOk).toBe(true)
    })

    test('propagates a findById failure other than CUSTOMER_NOT_FOUND', async () => {
      const { repository, useCase } = setup()
      jest
        .spyOn(repository, 'findById')
        .mockResolvedValue(Result.fail('DB_ERROR'))

      const result = await useCase.execute(input({ id: missingId }))

      expect(result.errors).toEqual(['DB_ERROR'])
      expect(repository.size).toBe(0)
    })

    test('propagates an update failure', async () => {
      const { repository, useCase } = setup()
      const created = await createCustomer(useCase)
      jest
        .spyOn(repository, 'update')
        .mockResolvedValue(Result.fail('DB_ERROR'))

      const result = await useCase.execute(input({ id: created.id }))

      expect(result.errors).toEqual(['DB_ERROR'])
      expect(result.instance).toBeUndefined()
      expect((await repository.findById(created.id)).instance).toBeInstanceOf(
        Customer,
      )
    })
  })
})
