import { Password } from '../../src/password'
import { FAKE_HASH } from '../mock/fake-password-crypto.provider'
import { InMemoryPasswordRepository } from '../mock/in-memory-password.repository'

const userId = '550e8400-e29b-41d4-a716-446655440000'

describe('InMemoryPasswordRepository', () => {
  test('findByUserId returns ok(null) when the user has no password', async () => {
    const repository = new InMemoryPasswordRepository()

    const result = await repository.findByUserId(userId)

    expect(result.isOk).toBe(true)
    expect(result.instance).toBeNull()
  })

  test('findByUserId returns the stored password', async () => {
    const repository = new InMemoryPasswordRepository()
    const password = Password.create({ userId, value: FAKE_HASH })
    await repository.create(password)

    const result = await repository.findByUserId(userId)

    expect(result.instance).toBe(password)
    expect(repository.size).toBe(1)
  })
})
