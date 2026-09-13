import { Id, Result } from '@mentoria-360/shared'
import { Brand, DeleteBrand, SaveBrand } from '../../src/brand'
import { InMemoryBrandRepository } from '../mock/in-memory-brand.repository'
import { InMemoryProductRepository } from '../mock/in-memory-product.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'

function setup() {
  const repository = new InMemoryBrandRepository()
  const useCase = new SaveBrand(repository)
  return { repository, useCase }
}

async function createBrand(useCase: SaveBrand, name: string, slug?: string) {
  const result = await useCase.execute({ name, slug })
  return result.instance
}

describe('SaveBrand', () => {
  describe('creation', () => {
    test('creates without id, generating a uuid and the slug', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({ name: 'Café & Cia' })

      expect(result.isOk).toBe(true)
      const dto = result.instance
      expect(Id.isValid(dto.id)).toBe(true)
      expect(dto).toMatchObject({
        name: 'Café & Cia',
        slug: 'cafe-cia',
        description: null,
        logoUrl: null,
        isActive: true,
      })
      expect((await repository.findById(dto.id)).isOk).toBe(true)
    })

    test('creates with the given id', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({
        id,
        name: 'Acme',
        description: 'Materiais de escritório',
        logoUrl: 'https://exemplo.com/acme.png',
      })

      expect(result.instance.id).toBe(id)
      const brand = (await repository.findById(id)).instance
      expect(brand.description).toBe('Materiais de escritório')
      expect(brand.logoUrl).toBe('https://exemplo.com/acme.png')
    })

    test('creates when the id does not belong to any brand', async () => {
      const { repository, useCase } = setup()
      const create = jest.spyOn(repository, 'create')
      const update = jest.spyOn(repository, 'update')

      const result = await useCase.execute({ id, name: 'Acme' })

      expect(result.isOk).toBe(true)
      expect(create).toHaveBeenCalledWith(expect.any(Brand))
      expect(update).not.toHaveBeenCalled()
      expect(repository.size).toBe(1)
    })

    test('fails with BRAND_NAME_ALREADY_EXISTS for the same name in another case', async () => {
      const { repository, useCase } = setup()
      await createBrand(useCase, 'Acme')

      const result = await useCase.execute({ name: 'ACME', slug: 'acme-2' })

      expect(result.errors).toEqual(['BRAND_NAME_ALREADY_EXISTS'])
      expect(repository.size).toBe(1)
    })

    test('fails with BRAND_SLUG_ALREADY_EXISTS for a used slug', async () => {
      const { repository, useCase } = setup()
      await createBrand(useCase, 'Acme')

      const result = await useCase.execute({ name: 'Acme Brasil', slug: 'acme' })

      expect(result.errors).toEqual(['BRAND_SLUG_ALREADY_EXISTS'])
      expect(repository.size).toBe(1)
    })

    test('keeps the name of a deleted brand reserved', async () => {
      const { repository, useCase } = setup()
      const acme = await createBrand(useCase, 'Acme')
      await new DeleteBrand(repository, new InMemoryProductRepository()).execute({ id: acme.id })

      const result = await useCase.execute({ name: 'Acme' })

      expect(result.errors).toEqual(['BRAND_NAME_ALREADY_EXISTS'])
      expect(repository.size).toBe(1)
    })

    test('fails with a validation error and stores nothing', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({ name: 'Acme', logoUrl: 'logo' })

      expect(result.errors).toEqual(['INVALID_URL'])
      expect(repository.size).toBe(0)
    })

    test('fails with INVALID_ID for a malformed id', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({ id: 'abc', name: 'Acme' })

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(repository.size).toBe(0)
    })
  })

  describe('update', () => {
    test('keeps its own name and slug without conflict', async () => {
      const { repository, useCase } = setup()
      const acme = await createBrand(useCase, 'Acme')

      const result = await useCase.execute({
        id: acme.id,
        name: 'Acme',
        slug: 'acme',
        description: 'Nova descrição',
      })

      expect(result.isOk).toBe(true)
      expect(result.instance.description).toBe('Nova descrição')
      expect((await repository.findById(acme.id)).instance.description).toBe(
        'Nova descrição',
      )
      expect(repository.size).toBe(1)
    })

    test('keeps the current slug when slug is not sent', async () => {
      const { repository, useCase } = setup()
      const acme = await createBrand(useCase, 'Acme')

      const result = await useCase.execute({ id: acme.id, name: 'Acme Brasil' })

      expect(result.instance).toMatchObject({ name: 'Acme Brasil', slug: 'acme' })
      expect((await repository.findBySlug('acme')).instance?.name).toBe(
        'Acme Brasil',
      )
    })

    test('fails with BRAND_NAME_ALREADY_EXISTS for the name of another brand', async () => {
      const { repository, useCase } = setup()
      await createBrand(useCase, 'Acme')
      const beta = await createBrand(useCase, 'Beta')

      const result = await useCase.execute({ id: beta.id, name: 'acme' })

      expect(result.errors).toEqual(['BRAND_NAME_ALREADY_EXISTS'])
      expect((await repository.findById(beta.id)).instance.name).toBe('Beta')
    })

    test('fails with BRAND_SLUG_ALREADY_EXISTS for the slug of another brand', async () => {
      const { useCase } = setup()
      await createBrand(useCase, 'Acme')
      const beta = await createBrand(useCase, 'Beta')

      const result = await useCase.execute({
        id: beta.id,
        name: 'Beta',
        slug: 'acme',
      })

      expect(result.errors).toEqual(['BRAND_SLUG_ALREADY_EXISTS'])
    })

    test('keeps undefined fields and clears null or empty ones', async () => {
      const { useCase } = setup()
      const created = await useCase.execute({
        name: 'Acme',
        description: 'Materiais de escritório',
        logoUrl: 'https://exemplo.com/acme.png',
        isActive: false,
      })
      const acme = created.instance

      const kept = await useCase.execute({ id: acme.id, name: 'Acme' })
      expect(kept.instance).toMatchObject({
        description: 'Materiais de escritório',
        logoUrl: 'https://exemplo.com/acme.png',
        isActive: false,
      })

      const cleared = await useCase.execute({
        id: acme.id,
        name: 'Acme',
        description: null,
        logoUrl: '',
        isActive: true,
      })
      expect(cleared.instance).toMatchObject({
        description: null,
        logoUrl: null,
        isActive: true,
      })
    })

    test('refreshes updatedAt and keeps createdAt', async () => {
      const { useCase } = setup()
      const acme = await createBrand(useCase, 'Acme')
      await new Promise((resolve) => setTimeout(resolve, 5))

      const result = await useCase.execute({ id: acme.id, name: 'Acme Brasil' })

      expect(result.instance.createdAt).toEqual(acme.createdAt)
      expect(result.instance.updatedAt.getTime()).toBeGreaterThan(
        acme.updatedAt.getTime(),
      )
    })

    test('fails with BRAND_NOT_FOUND for the id of a deleted brand', async () => {
      const { repository, useCase } = setup()
      const acme = await createBrand(useCase, 'Acme')
      await new DeleteBrand(repository, new InMemoryProductRepository()).execute({ id: acme.id })

      const result = await useCase.execute({ id: acme.id, name: 'Acme' })

      expect(result.errors).toEqual(['BRAND_NOT_FOUND'])
      expect((await repository.findById(acme.id)).isFailure).toBe(true)
    })

    test('propagates a findById failure other than BRAND_NOT_FOUND', async () => {
      const { repository, useCase } = setup()
      jest.spyOn(repository, 'findById').mockResolvedValue(Result.fail('DB_ERROR'))

      const result = await useCase.execute({ id, name: 'Acme' })

      expect(result.errors).toEqual(['DB_ERROR'])
      expect(repository.size).toBe(0)
    })
  })
})
