import { User } from '../../src/user'

const valid = { name: 'Ana Souza', email: 'ana@exemplo.com' }

describe('User', () => {
  test('creates with admin omitted as false', () => {
    const result = User.tryCreate(valid)

    expect(result.isOk).toBe(true)
    expect(result.instance.isAdmin).toBe(false)
    expect(result.instance.toDTO().admin).toBe(false)
  })

  test('creates an admin when admin is true', () => {
    const user = User.create({ ...valid, admin: true })

    expect(user.isAdmin).toBe(true)
  })

  test('normalizes email and defaults avatarUrl to null', () => {
    const user = User.create({ ...valid, email: ' Ana@Exemplo.com ' })

    expect(user.email).toBe('ana@exemplo.com')
    expect(user.avatarUrl).toBeNull()
  })

  test('keeps a valid avatarUrl', () => {
    const user = User.create({ ...valid, avatarUrl: 'https://cdn.jaja.dev/a.png' })

    expect(user.avatarUrl).toBe('https://cdn.jaja.dev/a.png')
  })

  test('fails when admin is not a boolean', () => {
    const result = User.tryCreate({
      ...valid,
      admin: 'yes' as unknown as boolean,
    })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_FLAG'])
  })

  test('fails when name has no surname', () => {
    const result = User.tryCreate({ ...valid, name: 'Ana' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['PERSON_NAME_SURNAME_MISSING'])
  })

  test('fails when email is invalid', () => {
    const result = User.tryCreate({ ...valid, email: 'ana@' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toContain('INVALID_EMAIL')
  })

  test('fails when avatarUrl is invalid', () => {
    const result = User.tryCreate({ ...valid, avatarUrl: 'ftp://x' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_URL'])
  })

  test('fails when id is invalid', () => {
    const result = User.tryCreate({ ...valid, id: 'not-a-uuid' })

    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('combines errors from several invalid attributes', () => {
    const result = User.tryCreate({ name: 'Ana', email: 'ana@', avatarUrl: 'x' })

    expect(result.errors).toEqual(
      expect.arrayContaining([
        'PERSON_NAME_SURNAME_MISSING',
        'INVALID_EMAIL',
        'INVALID_URL',
      ]),
    )
  })

  test('create throws on invalid props', () => {
    expect(() => User.create({ ...valid, name: 'Ana' })).toThrow()
  })

  test('toDTO exposes exactly the five public fields', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const dto = User.create({ ...valid, id }).toDTO()

    expect(Object.keys(dto).sort()).toEqual([
      'admin',
      'avatarUrl',
      'email',
      'id',
      'name',
    ])
    expect(dto).toEqual({
      id,
      name: 'Ana Souza',
      email: 'ana@exemplo.com',
      avatarUrl: null,
      admin: false,
    })
  })

  test('equals by id', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    const a = User.create({ ...valid, id })
    const b = User.create({ ...valid, id, name: 'Outra Pessoa' })

    expect(a.equals(b)).toBe(true)
  })
})
