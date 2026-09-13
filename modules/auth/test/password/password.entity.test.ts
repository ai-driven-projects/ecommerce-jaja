import { Password } from '../../src/password'
import { FAKE_HASH } from '../mock/fake-password-crypto.provider'

const userId = '550e8400-e29b-41d4-a716-446655440000'

describe('Password', () => {
  test('creates with a valid bcrypt hash', () => {
    const result = Password.tryCreate({ userId, value: FAKE_HASH })

    expect(result.isOk).toBe(true)
    expect(result.instance.userId).toBe(userId)
    expect(result.instance.value).toBe(FAKE_HASH)
  })

  test('accepts $2a and $2y prefixes', () => {
    const body = FAKE_HASH.slice(7)

    expect(Password.tryCreate({ userId, value: `$2a$12$${body}` }).isOk).toBe(true)
    expect(Password.tryCreate({ userId, value: `$2y$10$${body}` }).isOk).toBe(true)
  })

  test('fails with a plain text password', () => {
    const result = Password.tryCreate({ userId, value: '#Senha123' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['PASSWORD_NOT_HASHED'])
  })

  test('fails with an empty value', () => {
    const result = Password.tryCreate({ userId, value: '   ' })

    expect(result.errors).toEqual(['PASSWORD_EMPTY'])
  })

  test('fails without userId', () => {
    const result = Password.tryCreate({ userId: '', value: FAKE_HASH })

    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails with an invalid userId', () => {
    const result = Password.tryCreate({ userId: 'abc', value: FAKE_HASH })

    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('create throws on invalid props', () => {
    expect(() => Password.create({ userId, value: 'plain' })).toThrow()
  })

  test('toDTO never exposes the hash', () => {
    const dto = Password.create({ userId, value: FAKE_HASH }).toDTO()

    expect(Object.keys(dto).sort()).toEqual(['id', 'userId'])
  })
})
