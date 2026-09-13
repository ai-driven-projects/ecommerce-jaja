import { Password } from '../../src/password'
import { AuthenticateUser } from '../../src/app'
import { User } from '../../src/user'
import {
  FAKE_HASH,
  FakePasswordCryptoProvider,
} from '../mock/fake-password-crypto.provider'
import { InMemoryPasswordRepository } from '../mock/in-memory-password.repository'
import { InMemoryUserRepository } from '../mock/in-memory-user.repository'

async function setup(admin: boolean) {
  const userRepository = new InMemoryUserRepository()
  const passwordRepository = new InMemoryPasswordRepository()
  const useCase = new AuthenticateUser(
    userRepository,
    passwordRepository,
    new FakePasswordCryptoProvider('#Senha123'),
  )
  const user = User.create({ name: 'Ana Souza', email: 'ana@exemplo.com', admin })
  await userRepository.create(user)
  await passwordRepository.create(
    Password.create({ userId: user.id, value: FAKE_HASH }),
  )
  return { userRepository, passwordRepository, useCase, user }
}

describe('AuthenticateUser', () => {
  test('returns the user DTO with admin = true for an admin', async () => {
    const { useCase, user } = await setup(true)

    const result = await useCase.execute({
      email: 'ana@exemplo.com',
      password: '#Senha123',
    })

    expect(result.isOk).toBe(true)
    expect(result.instance).toEqual({
      id: user.id,
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      avatarUrl: null,
      admin: true,
    })
    expect(JSON.stringify(result.instance)).not.toContain(FAKE_HASH)
  })

  test('returns admin = false for a regular user', async () => {
    const { useCase } = await setup(false)

    const result = await useCase.execute({
      email: 'ANA@exemplo.com',
      password: '#Senha123',
    })

    expect(result.instance.admin).toBe(false)
  })

  test('unknown email and wrong password produce the same failure', async () => {
    const { useCase } = await setup(false)

    const unknownEmail = await useCase.execute({
      email: 'nobody@exemplo.com',
      password: '#Senha123',
    })
    const wrongPassword = await useCase.execute({
      email: 'ana@exemplo.com',
      password: '#Errada123',
    })

    expect(unknownEmail.errors).toEqual(['INVALID_CREDENTIALS'])
    expect(wrongPassword.errors).toEqual(['INVALID_CREDENTIALS'])
    expect(unknownEmail.errors).toEqual(wrongPassword.errors)
  })

  test('fails with INVALID_CREDENTIALS when the user has no password', async () => {
    const userRepository = new InMemoryUserRepository()
    const useCase = new AuthenticateUser(
      userRepository,
      new InMemoryPasswordRepository(),
      new FakePasswordCryptoProvider(),
    )
    await userRepository.create(
      User.create({ name: 'Sem Senha', email: 'sem@exemplo.com' }),
    )

    const result = await useCase.execute({
      email: 'sem@exemplo.com',
      password: '#Senha123',
    })

    expect(result.errors).toEqual(['INVALID_CREDENTIALS'])
  })

  test('fails with INVALID_EMAIL for a malformed email', async () => {
    const { useCase } = await setup(false)

    const result = await useCase.execute({ email: 'ana@', password: 'x' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toContain('INVALID_EMAIL')
  })
})
