import { DeleteStore, Store } from '../../src/store'
import { InMemoryStoreRepository } from '../mock/in-memory-store.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'

async function setup() {
  const repository = new InMemoryStoreRepository()
  const useCase = new DeleteStore(repository)
  const store = Store.create({
    id,
    name: 'Loja Aldeota',
    latitude: -3.7356,
    longitude: -38.5012,
  })
  await repository.create(store)
  return { repository, useCase, store }
}

describe('DeleteStore', () => {
  test('soft deletes the store so lookups stop returning it', async () => {
    const { repository, useCase } = await setup()

    const result = await useCase.execute({ id })

    expect(result.isOk).toBe(true)
    expect((await repository.findById(id)).errors).toEqual(['STORE_NOT_FOUND'])
    const bySlug = await repository.findBySlug('loja-aldeota')
    expect(bySlug.isOk).toBe(true)
    expect(bySlug.instance).toBeNull()
    expect((await repository.findByName('Loja Aldeota')).instance).toBeNull()
    expect(repository.size).toBe(1)
  })

  test('fails with STORE_NOT_FOUND for an unknown id', async () => {
    const { repository, useCase } = await setup()
    const remove = jest.spyOn(repository, 'delete')

    const result = await useCase.execute({
      id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    })

    expect(result.errors).toEqual(['STORE_NOT_FOUND'])
    expect(remove).not.toHaveBeenCalled()
  })

  test('fails with STORE_NOT_FOUND for an already deleted store', async () => {
    const { useCase } = await setup()
    await useCase.execute({ id })

    const result = await useCase.execute({ id })

    expect(result.errors).toEqual(['STORE_NOT_FOUND'])
  })
})
