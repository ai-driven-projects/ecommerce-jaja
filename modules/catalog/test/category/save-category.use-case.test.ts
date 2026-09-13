import { Id, Result } from '@mentoria-360/shared'
import {
  Category,
  DeleteCategory,
  SaveCategory,
  SaveCategoryInput,
} from '../../src/category'
import { InMemoryCategoryRepository } from '../mock/in-memory-category.repository'
import { InMemoryProductRepository } from '../mock/in-memory-product.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'
const unknownId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

function setup() {
  const repository = new InMemoryCategoryRepository()
  const useCase = new SaveCategory(repository)
  return { repository, useCase }
}

async function save(useCase: SaveCategory, input: SaveCategoryInput) {
  const result = await useCase.execute(input)
  if (result.isFailure) throw new Error(result.errors.join(', '))
  return result.instance.id
}

async function find(repository: InMemoryCategoryRepository, categoryId: string) {
  return (await repository.findById(categoryId)).instance
}

// Escolar > Borrachas > Borrachas Técnicas, and Suprimentos para Escritório > Papéis.
async function seedTree(useCase: SaveCategory) {
  const escolar = await save(useCase, { name: 'Escolar' })
  const borrachas = await save(useCase, { name: 'Borrachas', parentId: escolar })
  const tecnicas = await save(useCase, {
    name: 'Borrachas Técnicas',
    parentId: borrachas,
  })
  const escritorio = await save(useCase, {
    name: 'Suprimentos para Escritório',
    slug: 'escritorio',
  })
  const papeis = await save(useCase, { name: 'Papéis', parentId: escritorio })
  return { escolar, borrachas, tecnicas, escritorio, papeis }
}

describe('SaveCategory', () => {
  describe('creation', () => {
    test('creates a root category with the defaults', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({ name: 'Escolar' })

      expect(result.isOk).toBe(true)
      expect(Object.keys(result.instance)).toEqual(['id'])
      expect(Id.isValid(result.instance.id)).toBe(true)
      const category = await find(repository, result.instance.id)
      expect(category).toMatchObject({
        name: 'Escolar',
        slug: 'escolar',
        description: null,
        parentId: null,
        order: 0,
        isHighlighted: false,
        imageUrl: null,
        isActive: true,
      })
    })

    test('creates a child and a grandchild', async () => {
      const { repository, useCase } = setup()

      const { escolar, borrachas, tecnicas } = await seedTree(useCase)

      expect((await find(repository, borrachas)).parentId).toBe(escolar)
      const grandchild = await find(repository, tecnicas)
      expect(grandchild.parentId).toBe(borrachas)
      expect(grandchild.slug).toBe('borrachas-tecnicas')
    })

    test('creates with all the given attributes', async () => {
      const { repository, useCase } = setup()
      const { escolar } = await seedTree(useCase)

      const categoryId = await save(useCase, {
        name: 'Cadernos',
        slug: 'cadernos-escolares',
        description: 'Cadernos de todos os tamanhos',
        parentId: escolar,
        order: 2,
        isHighlighted: true,
        imageUrl: 'https://exemplo.com/cadernos.png',
        isActive: false,
      })

      expect(await find(repository, categoryId)).toMatchObject({
        name: 'Cadernos',
        slug: 'cadernos-escolares',
        description: 'Cadernos de todos os tamanhos',
        parentId: escolar,
        order: 2,
        isHighlighted: true,
        imageUrl: 'https://exemplo.com/cadernos.png',
        isActive: false,
      })
    })

    test('fails with CATEGORY_MAX_DEPTH_EXCEEDED for a fourth level', async () => {
      const { repository, useCase } = setup()
      const { tecnicas } = await seedTree(useCase)

      const result = await useCase.execute({ name: 'Quarto nível', parentId: tecnicas })

      expect(result.errors).toEqual(['CATEGORY_MAX_DEPTH_EXCEEDED'])
      expect(repository.size).toBe(5)
    })

    test('fails with PARENT_CATEGORY_NOT_FOUND for an unknown parent', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({ name: 'Borrachas', parentId: unknownId })

      expect(result.errors).toEqual(['PARENT_CATEGORY_NOT_FOUND'])
      expect(repository.size).toBe(0)
    })

    test('fails with PARENT_CATEGORY_NOT_FOUND for a deleted parent', async () => {
      const { repository, useCase } = setup()
      const escolar = await save(useCase, { name: 'Escolar' })
      await new DeleteCategory(repository, new InMemoryProductRepository()).execute({ id: escolar })

      const result = await useCase.execute({ name: 'Borrachas', parentId: escolar })

      expect(result.errors).toEqual(['PARENT_CATEGORY_NOT_FOUND'])
      expect(repository.size).toBe(1)
    })

    test('fails with INVALID_ID for a malformed parentId', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({ name: 'Borrachas', parentId: 'abc' })

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(repository.size).toBe(0)
    })

    test('fails with CATEGORY_SLUG_ALREADY_EXISTS for a slug used in another branch', async () => {
      const { repository, useCase } = setup()
      const { escritorio } = await seedTree(useCase)

      const result = await useCase.execute({
        name: 'Escolar',
        slug: 'escolar',
        parentId: escritorio,
      })

      expect(result.errors).toEqual(['CATEGORY_SLUG_ALREADY_EXISTS'])
      expect(repository.size).toBe(5)
    })

    test('keeps the slug of a deleted category reserved', async () => {
      const { repository, useCase } = setup()
      const { papeis } = await seedTree(useCase)
      await new DeleteCategory(repository, new InMemoryProductRepository()).execute({ id: papeis })

      const result = await useCase.execute({ name: 'Papéis' })

      expect(result.errors).toEqual(['CATEGORY_SLUG_ALREADY_EXISTS'])
      expect(repository.size).toBe(5)
    })

    test('creates with the given id when it does not belong to any category', async () => {
      const { repository, useCase } = setup()
      const create = jest.spyOn(repository, 'create')
      const update = jest.spyOn(repository, 'update')

      const result = await useCase.execute({ id, name: 'Escolar' })

      expect(result.instance).toEqual({ id })
      expect(create).toHaveBeenCalledWith(expect.any(Category))
      expect(update).not.toHaveBeenCalled()
      expect((await find(repository, id)).name).toBe('Escolar')
    })

    test.each([
      [{ name: 'A' }, 'NAME_TOO_SHORT'],
      [{ name: 'Escolar', imageUrl: 'ftp://x' }, 'INVALID_URL'],
      [{ name: 'Escolar', order: -1 }, 'INVALID_ORDER'],
      [{ name: 'Escolar', slug: 'Escolar Geral' }, 'INVALID_ALIAS'],
      [{ name: 'Escolar', description: 'a'.repeat(501) }, 'TEXT_TOO_LONG'],
    ])('fails with a validation error and stores nothing (%o)', async (input, code) => {
      const { repository, useCase } = setup()

      const result = await useCase.execute(input)

      expect(result.errors).toEqual([code])
      expect(repository.size).toBe(0)
    })

    test('fails with INVALID_ID for a malformed id', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({ id: 'abc', name: 'Escolar' })

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(repository.size).toBe(0)
    })

    test('propagates a findById failure other than CATEGORY_NOT_FOUND', async () => {
      const { repository, useCase } = setup()
      jest.spyOn(repository, 'findById').mockResolvedValue(Result.fail('DB_ERROR'))

      const result = await useCase.execute({ id, name: 'Escolar' })

      expect(result.errors).toEqual(['DB_ERROR'])
      expect(repository.size).toBe(0)
    })
  })

  describe('update', () => {
    test('keeps its own slug when it is sent again', async () => {
      const { repository, useCase } = setup()
      const { escolar } = await seedTree(useCase)

      const result = await useCase.execute({
        id: escolar,
        name: 'Material Escolar',
        slug: 'escolar',
      })

      expect(result.instance).toEqual({ id: escolar })
      expect(await find(repository, escolar)).toMatchObject({
        name: 'Material Escolar',
        slug: 'escolar',
      })
      expect(repository.size).toBe(5)
    })

    test('keeps the current slug when slug is omitted', async () => {
      const { repository, useCase } = setup()
      const { borrachas } = await seedTree(useCase)

      await save(useCase, { id: borrachas, name: 'Borrachas Escolares' })

      expect((await find(repository, borrachas)).slug).toBe('borrachas')
    })

    test('fails with CATEGORY_SLUG_ALREADY_EXISTS for the slug of another category', async () => {
      const { repository, useCase } = setup()
      const { borrachas } = await seedTree(useCase)

      const result = await useCase.execute({
        id: borrachas,
        name: 'Borrachas',
        slug: 'papeis',
      })

      expect(result.errors).toEqual(['CATEGORY_SLUG_ALREADY_EXISTS'])
      expect((await find(repository, borrachas)).slug).toBe('borrachas')
    })

    test('changes name, order, isHighlighted and isActive, refreshing updatedAt', async () => {
      const { repository, useCase } = setup()
      const { escolar } = await seedTree(useCase)
      const before = await find(repository, escolar)
      await new Promise((resolve) => setTimeout(resolve, 5))

      await save(useCase, {
        id: escolar,
        name: 'Material Escolar',
        order: 5,
        isHighlighted: true,
        isActive: false,
      })

      const after = await find(repository, escolar)
      expect(after).toMatchObject({
        name: 'Material Escolar',
        order: 5,
        isHighlighted: true,
        isActive: false,
      })
      expect(after.createdAt).toEqual(before.createdAt)
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime())
    })

    test('keeps the omitted fields', async () => {
      const { repository, useCase } = setup()
      const { escolar } = await seedTree(useCase)
      const categoryId = await save(useCase, {
        name: 'Cadernos',
        description: 'Itens escolares',
        parentId: escolar,
        order: 4,
        isHighlighted: true,
        imageUrl: 'https://exemplo.com/cadernos.png',
        isActive: false,
      })

      await save(useCase, { id: categoryId, name: 'Cadernos Universitários' })

      expect(await find(repository, categoryId)).toMatchObject({
        name: 'Cadernos Universitários',
        slug: 'cadernos',
        description: 'Itens escolares',
        parentId: escolar,
        order: 4,
        isHighlighted: true,
        imageUrl: 'https://exemplo.com/cadernos.png',
        isActive: false,
      })
    })

    test('clears description and imageUrl with null', async () => {
      const { repository, useCase } = setup()
      const categoryId = await save(useCase, {
        name: 'Escolar',
        description: 'Itens escolares',
        imageUrl: 'https://exemplo.com/escolar.png',
      })

      await save(useCase, {
        id: categoryId,
        name: 'Escolar',
        description: null,
        imageUrl: null,
      })

      expect(await find(repository, categoryId)).toMatchObject({
        description: null,
        imageUrl: null,
      })
    })

    test('turns the category into a root with parentId: null', async () => {
      const { repository, useCase } = setup()
      const { borrachas, tecnicas } = await seedTree(useCase)

      await save(useCase, { id: borrachas, name: 'Borrachas', parentId: null })

      expect((await find(repository, borrachas)).parentId).toBeNull()
      expect((await find(repository, tecnicas)).parentId).toBe(borrachas)
    })

    test('moves a subgroup to another group', async () => {
      const { repository, useCase } = setup()
      const { tecnicas, papeis } = await seedTree(useCase)

      await save(useCase, { id: tecnicas, name: 'Borrachas Técnicas', parentId: papeis })

      expect((await find(repository, tecnicas)).parentId).toBe(papeis)
    })

    test('moves a group with children under another root', async () => {
      const { repository, useCase } = setup()
      const { borrachas, escritorio } = await seedTree(useCase)

      await save(useCase, { id: borrachas, name: 'Borrachas', parentId: escritorio })

      expect((await find(repository, borrachas)).parentId).toBe(escritorio)
    })

    test('fails with CATEGORY_MAX_DEPTH_EXCEEDED when moving a category with children under a level-2 parent', async () => {
      const { repository, useCase } = setup()
      const escolar = await save(useCase, { name: 'Escolar' })
      await save(useCase, { name: 'Borrachas', parentId: escolar })
      const escritorio = await save(useCase, { name: 'Escritório' })
      const papeis = await save(useCase, { name: 'Papéis', parentId: escritorio })
      const update = jest.spyOn(repository, 'update')

      const result = await useCase.execute({
        id: escolar,
        name: 'Escolar',
        parentId: papeis,
      })

      expect(result.errors).toEqual(['CATEGORY_MAX_DEPTH_EXCEEDED'])
      expect(update).not.toHaveBeenCalled()
      expect((await find(repository, escolar)).parentId).toBeNull()
    })

    test('fails with CATEGORY_CYCLE when the parent is the category itself', async () => {
      const { repository, useCase } = setup()
      const { borrachas, escolar } = await seedTree(useCase)

      const result = await useCase.execute({
        id: borrachas,
        name: 'Borrachas',
        parentId: borrachas,
      })

      expect(result.errors).toEqual(['CATEGORY_CYCLE'])
      expect((await find(repository, borrachas)).parentId).toBe(escolar)
    })

    test('fails with CATEGORY_CYCLE when the parent is a child', async () => {
      const { repository, useCase } = setup()
      const { escolar, borrachas } = await seedTree(useCase)

      const result = await useCase.execute({
        id: escolar,
        name: 'Escolar',
        parentId: borrachas,
      })

      expect(result.errors).toEqual(['CATEGORY_CYCLE'])
      expect((await find(repository, escolar)).parentId).toBeNull()
    })

    test('fails with CATEGORY_CYCLE for a descendant parent even when the depth would also be exceeded', async () => {
      const { repository, useCase } = setup()
      const { escolar, tecnicas } = await seedTree(useCase)
      const update = jest.spyOn(repository, 'update')

      const result = await useCase.execute({
        id: escolar,
        name: 'Escolar',
        parentId: tecnicas,
      })

      expect(result.errors).toEqual(['CATEGORY_CYCLE'])
      expect(update).not.toHaveBeenCalled()
      expect((await find(repository, escolar)).parentId).toBeNull()
    })

    test('fails with CATEGORY_NOT_FOUND for the id of a deleted category', async () => {
      const { repository, useCase } = setup()
      const { papeis } = await seedTree(useCase)
      await new DeleteCategory(repository, new InMemoryProductRepository()).execute({ id: papeis })

      const result = await useCase.execute({ id: papeis, name: 'Papéis', slug: 'papeis-2' })

      expect(result.errors).toEqual(['CATEGORY_NOT_FOUND'])
      expect(repository.size).toBe(5)
    })

    test('propagates a findByParentId failure', async () => {
      const { repository, useCase } = setup()
      const { escolar } = await seedTree(useCase)
      jest
        .spyOn(repository, 'findByParentId')
        .mockResolvedValue(Result.fail('DB_ERROR'))

      const result = await useCase.execute({ id: escolar, name: 'Escolar' })

      expect(result.errors).toEqual(['DB_ERROR'])
    })

    test('stops walking a hierarchy loop stored by corrupted data', async () => {
      const { repository, useCase } = setup()
      const a = await save(useCase, { name: 'Categoria A' })
      const b = await save(useCase, { name: 'Categoria B', parentId: a })
      // Bypasses the use case to store the loop A -> B -> A.
      const looped = (await find(repository, a)).cloneWith({ parentId: b })
      await repository.update(looped.instance)

      const result = await useCase.execute({ name: 'Categoria C', parentId: a })

      expect(result.errors).toEqual(['CATEGORY_MAX_DEPTH_EXCEEDED'])
    })
  })
})
