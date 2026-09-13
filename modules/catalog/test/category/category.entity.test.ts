import { Category } from '../../src/category'

const id = '550e8400-e29b-41d4-a716-446655440000'
const parentId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const valid = {
  name: 'Borrachas',
  slug: 'borrachas',
  description: 'Borrachas escolares',
  parentId,
  order: 3,
  isHighlighted: true,
  imageUrl: 'https://exemplo.com/borrachas.png',
  isActive: false,
}

describe('Category', () => {
  test('creates with valid attributes', () => {
    const result = Category.tryCreate({ ...valid, id })

    expect(result.isOk).toBe(true)
    const category = result.instance
    expect(category.id).toBe(id)
    expect(category.name).toBe('Borrachas')
    expect(category.slug).toBe('borrachas')
    expect(category.description).toBe('Borrachas escolares')
    expect(category.parentId).toBe(parentId)
    expect(category.order).toBe(3)
    expect(category.isHighlighted).toBe(true)
    expect(category.imageUrl).toBe('https://exemplo.com/borrachas.png')
    expect(category.isActive).toBe(false)
    expect(category.isRoot).toBe(false)
  })

  test('applies the defaults when only the name is given', () => {
    const category = Category.create({ name: 'Escolar' })

    expect(category.slug).toBe('escolar')
    expect(category.description).toBeNull()
    expect(category.parentId).toBeNull()
    expect(category.order).toBe(0)
    expect(category.isHighlighted).toBe(false)
    expect(category.imageUrl).toBeNull()
    expect(category.isActive).toBe(true)
    expect(category.isRoot).toBe(true)
  })

  test('trims the name', () => {
    const category = Category.create({ name: '  Escolar  ' })

    expect(category.name).toBe('Escolar')
  })

  test('derives the slug from the name when it is missing', () => {
    const category = Category.create({ name: 'Borrachas Técnicas' })

    expect(category.slug).toBe('borrachas-tecnicas')
  })

  test('derives the slug from the name when it is blank', () => {
    const category = Category.create({ name: 'Artes & Pintura', slug: '  ' })

    expect(category.slug).toBe('artes-pintura')
  })

  test('fails when the name is too short', () => {
    const result = Category.tryCreate({ name: 'A' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toContain('NAME_TOO_SHORT')
  })

  test('fails when the slug is invalid', () => {
    const result = Category.tryCreate({
      name: 'Borrachas',
      slug: 'borrachas técnicas',
    })

    expect(result.errors).toEqual(['INVALID_ALIAS'])
  })

  test('fails when the description has 501 characters', () => {
    const result = Category.tryCreate({
      name: 'Escolar',
      description: 'a'.repeat(501),
    })

    expect(result.errors).toEqual(['TEXT_TOO_LONG'])
  })

  test('accepts a description with 500 characters', () => {
    const result = Category.tryCreate({
      name: 'Escolar',
      description: 'a'.repeat(500),
    })

    expect(result.isOk).toBe(true)
  })

  test('fails when imageUrl is not http or https', () => {
    const result = Category.tryCreate({ name: 'Escolar', imageUrl: 'ftp://x' })

    expect(result.errors).toEqual(['INVALID_URL'])
  })

  test('fails when order is negative', () => {
    const result = Category.tryCreate({ name: 'Escolar', order: -1 })

    expect(result.errors).toEqual(['INVALID_ORDER'])
  })

  test('fails when order is not an integer', () => {
    const result = Category.tryCreate({ name: 'Escolar', order: 1.5 })

    expect(result.errors).toEqual(['INVALID_ORDER'])
  })

  test('fails when parentId is not a uuid', () => {
    const result = Category.tryCreate({ name: 'Escolar', parentId: 'abc' })

    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails with CATEGORY_CYCLE when parentId equals the id', () => {
    const result = Category.tryCreate({ id, name: 'Escolar', parentId: id })

    expect(result.errors).toEqual(['CATEGORY_CYCLE'])
  })

  test('combines the errors of several invalid attributes', () => {
    const result = Category.tryCreate({
      name: 'A',
      imageUrl: 'ftp://x',
      order: -1,
    })

    expect(result.errors).toEqual(
      expect.arrayContaining(['NAME_TOO_SHORT', 'INVALID_URL', 'INVALID_ORDER']),
    )
  })

  test('create throws on invalid props', () => {
    expect(() => Category.create({ name: 'A' })).toThrow()
  })

  test('cloneWith keeps undefined props and clears null ones', () => {
    const category = Category.create({ ...valid, id })

    const kept = category.cloneWith({ name: 'Borrachas Escolares' })
    expect(kept.instance).toMatchObject({
      name: 'Borrachas Escolares',
      slug: 'borrachas',
      description: 'Borrachas escolares',
      parentId,
      imageUrl: 'https://exemplo.com/borrachas.png',
    })

    const cleared = category.cloneWith({
      parentId: null,
      description: null,
      imageUrl: null,
    })
    expect(cleared.instance.parentId).toBeNull()
    expect(cleared.instance.description).toBeNull()
    expect(cleared.instance.imageUrl).toBeNull()
  })

  test('cloneWith revalidates the changed props', () => {
    const category = Category.create({ ...valid, id })

    expect(category.cloneWith({ imageUrl: 'imagem' }).errors).toEqual([
      'INVALID_URL',
    ])
    expect(category.cloneWith({ parentId: id }).errors).toEqual([
      'CATEGORY_CYCLE',
    ])
  })

  test('equals compares by id', () => {
    const a = Category.create({ id, name: 'Escolar' })
    const b = Category.create({ id, name: 'Outro nome' })
    const c = Category.create({ name: 'Escolar' })

    expect(a.equals(b)).toBe(true)
    expect(a.notEquals(c)).toBe(true)
  })
})
