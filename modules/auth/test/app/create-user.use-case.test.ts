import { Result } from '@mentoria-360/shared'
import { Password } from '../../src/password'
import { CreateUser, CreateUserInput } from '../../src/app'
import { User } from '../../src/user'
import {
  FAKE_HASH,
  FakePasswordCryptoProvider,
} from '../mock/fake-password-crypto.provider'
import { FakeTransactionManager } from '../mock/fake-transaction.manager'
import { InMemoryPasswordRepository } from '../mock/in-memory-password.repository'
import { InMemoryUserRepository } from '../mock/in-memory-user.repository'

const input: CreateUserInput = {
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  password: '#Senha123',
}

function setup() {
  const userRepository = new InMemoryUserRepository()
  const passwordRepository = new InMemoryPasswordRepository()
  const passwordCrypto = new FakePasswordCryptoProvider()
  const transactionManager = new FakeTransactionManager()
  const useCase = new CreateUser(
    userRepository,
    passwordRepository,
    passwordCrypto,
    transactionManager,
  )
  return { userRepository, passwordRepository, transactionManager, useCase }
}

describe('CreateUser', () => {
  test('stores the user with admin = false and the password hash', async () => {
    const { userRepository, passwordRepository, useCase } = setup()

    const result = await useCase.execute(input)

    expect(result.isOk).toBe(true)
    const user = (await userRepository.findByEmail(input.email)).instance!
    expect(user.name).toBe('Ana Souza')
    expect(user.isAdmin).toBe(false)
    const password = (await passwordRepository.findByUserId(user.id)).instance!
    expect(password.value).toBe(FAKE_HASH)
  })

  test('stores the optional avatarUrl', async () => {
    const { userRepository, useCase } = setup()

    await useCase.execute({ ...input, avatarUrl: 'https://cdn.jaja.dev/a.png' })

    const user = (await userRepository.findByEmail(input.email)).instance!
    expect(user.avatarUrl).toBe('https://cdn.jaja.dev/a.png')
  })

  test('runs both writes inside the transaction context', async () => {
    const { userRepository, passwordRepository, transactionManager, useCase } =
      setup()
    const userCreate = jest.spyOn(userRepository, 'create')
    const passwordCreate = jest.spyOn(passwordRepository, 'create')

    await useCase.execute(input)

    expect(transactionManager.calls).toBe(1)
    expect(userCreate).toHaveBeenCalledWith(
      expect.any(User),
      transactionManager.context,
    )
    expect(passwordCreate).toHaveBeenCalledWith(
      expect.any(Password),
      transactionManager.context,
    )
  })

  test('ignores an extra admin flag and still stores admin = false', async () => {
    const { userRepository, useCase } = setup()

    const result = await useCase.execute({
      ...input,
      admin: true,
    } as CreateUserInput)

    expect(result.isOk).toBe(true)
    const user = (await userRepository.findByEmail(input.email)).instance!
    expect(user.isAdmin).toBe(false)
  })

  test('fails with EMAIL_ALREADY_EXISTS and stores nothing new', async () => {
    const { userRepository, passwordRepository, useCase } = setup()
    await useCase.execute(input)

    const result = await useCase.execute({ ...input, name: 'Outra Pessoa' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['EMAIL_ALREADY_EXISTS'])
    expect(userRepository.size).toBe(1)
    expect(passwordRepository.size).toBe(1)
  })

  test('fails with a weak password and stores nothing', async () => {
    const { userRepository, passwordRepository, transactionManager, useCase } =
      setup()

    const result = await useCase.execute({ ...input, password: '123456' })

    expect(result.errors).toEqual(['STRONG_PASSWORD_TOO_WEAK'])
    expect(userRepository.size).toBe(0)
    expect(passwordRepository.size).toBe(0)
    expect(transactionManager.calls).toBe(0)
  })

  test('fails with an invalid name and stores nothing', async () => {
    const { userRepository, passwordRepository, useCase } = setup()

    const result = await useCase.execute({ ...input, name: 'Ana' })

    expect(result.errors).toEqual(['PERSON_NAME_SURNAME_MISSING'])
    expect(userRepository.size).toBe(0)
    expect(passwordRepository.size).toBe(0)
  })

  test('fails with an invalid email and stores nothing', async () => {
    const { userRepository, useCase } = setup()

    const result = await useCase.execute({ ...input, email: 'ana@' })

    expect(result.errors).toContain('INVALID_EMAIL')
    expect(userRepository.size).toBe(0)
  })

  test('fails with an invalid avatarUrl and stores nothing', async () => {
    const { userRepository, useCase } = setup()

    const result = await useCase.execute({ ...input, avatarUrl: 'not-a-url' })

    expect(result.errors).toEqual(['INVALID_URL'])
    expect(userRepository.size).toBe(0)
  })

  test('propagates a password persistence failure as a failed result', async () => {
    const { passwordRepository, useCase } = setup()
    jest
      .spyOn(passwordRepository, 'create')
      .mockResolvedValue(Result.fail('DB_ERROR'))

    const result = await useCase.execute(input)

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['DB_ERROR'])
  })
})
