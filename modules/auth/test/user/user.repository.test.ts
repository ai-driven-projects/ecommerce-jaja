import { User } from '../../src/user'
import { InMemoryUserRepository } from '../mock/in-memory-user.repository'

describe('InMemoryUserRepository', () => {
  test('findByEmail returns ok(null) when email is absent', async () => {
    const repository = new InMemoryUserRepository()

    const result = await repository.findByEmail('nobody@exemplo.com')

    expect(result.isOk).toBe(true)
    expect(result.instance).toBeNull()
  })

  test('findByEmail returns the user regardless of case', async () => {
    const repository = new InMemoryUserRepository()
    const user = User.create({ name: 'Ana Souza', email: 'ana@exemplo.com' })
    await repository.create(user)

    const result = await repository.findByEmail('ANA@exemplo.com')

    expect(result.instance).toBe(user)
  })

  test('findById fails when missing', async () => {
    const repository = new InMemoryUserRepository()

    const result = await repository.findById(
      '550e8400-e29b-41d4-a716-446655440000',
    )

    expect(result.isFailure).toBe(true)
  })
})
