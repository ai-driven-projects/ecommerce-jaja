import { Brand } from '../../src/brand'

const id = '550e8400-e29b-41d4-a716-446655440000'
const valid = {
  name: 'Acme',
  slug: 'acme',
  description: 'Materiais de escritório',
  logoUrl: 'https://exemplo.com/acme.png',
  isActive: false,
}

describe('Brand', () => {
  test('creates with valid attributes', () => {
    const result = Brand.tryCreate({ ...valid, id })

    expect(result.isOk).toBe(true)
    const brand = result.instance
    expect(brand.id).toBe(id)
    expect(brand.name).toBe('Acme')
    expect(brand.slug).toBe('acme')
    expect(brand.description).toBe('Materiais de escritório')
    expect(brand.logoUrl).toBe('https://exemplo.com/acme.png')
    expect(brand.isActive).toBe(false)
  })

  test('defaults isActive to true and optional fields to null', () => {
    const brand = Brand.create({ name: 'Acme' })

    expect(brand.isActive).toBe(true)
    expect(brand.description).toBeNull()
    expect(brand.logoUrl).toBeNull()
  })

  test('derives the slug from the name when it is missing', () => {
    const brand = Brand.create({ name: 'Café & Cia' })

    expect(brand.slug).toBe('cafe-cia')
  })

  test('derives the slug from the name when it is blank', () => {
    const brand = Brand.create({ name: 'Make+', slug: '' })

    expect(brand.slug).toBe('make')
  })

  test('fails when the name is empty', () => {
    const result = Brand.tryCreate({ name: '' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toContain('NAME_TOO_SHORT')
  })

  test('fails when the slug has spaces and uppercase letters', () => {
    const result = Brand.tryCreate({ name: 'Acme', slug: 'Acme Marca' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_ALIAS'])
  })

  test('fails when logoUrl is not http or https', () => {
    const result = Brand.tryCreate({ name: 'Acme', logoUrl: 'ftp://x' })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_URL'])
  })

  test('fails when the description has 501 characters', () => {
    const result = Brand.tryCreate({
      name: 'Acme',
      description: 'a'.repeat(501),
    })

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['TEXT_TOO_LONG'])
  })

  test('accepts a description with 500 characters', () => {
    const result = Brand.tryCreate({
      name: 'Acme',
      description: 'a'.repeat(500),
    })

    expect(result.isOk).toBe(true)
  })

  test('create throws on invalid props', () => {
    expect(() => Brand.create({ name: 'A' })).toThrow()
  })

  test('cloneWith revalidates the changed props', () => {
    const brand = Brand.create({ ...valid, id })

    expect(brand.cloneWith({ name: 'Acme Brasil' }).instance.slug).toBe('acme')
    expect(brand.cloneWith({ logoUrl: 'logo' }).errors).toEqual(['INVALID_URL'])
  })

  test('toDTO exposes exactly the public fields', () => {
    const brand = Brand.create({ name: 'Acme', id })
    const dto = brand.toDTO()

    expect(Object.keys(dto).sort()).toEqual([
      'createdAt',
      'description',
      'id',
      'isActive',
      'logoUrl',
      'name',
      'slug',
      'updatedAt',
    ])
    expect(dto).toEqual({
      id,
      name: 'Acme',
      slug: 'acme',
      description: null,
      logoUrl: null,
      isActive: true,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    })
  })
})
