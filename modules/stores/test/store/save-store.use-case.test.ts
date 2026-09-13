import { Id, Result } from '@mentoria-360/shared'
import { DeleteStore, SaveStore, SaveStoreInput, Store } from '../../src/store'
import { InMemoryStoreRepository } from '../mock/in-memory-store.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'
const aldeota: SaveStoreInput = {
  name: 'Loja Aldeota',
  phone: '(85) 3000-1001',
  address: 'Rua Silva Paulet, 1100 – Aldeota, Fortaleza/CE',
  latitude: -3.7356,
  longitude: -38.5012,
  deliveryRadiusMeters: 2500,
}

function setup() {
  const repository = new InMemoryStoreRepository()
  const useCase = new SaveStore(repository)
  return { repository, useCase }
}

async function createStore(useCase: SaveStore, input: SaveStoreInput = aldeota) {
  const result = await useCase.execute(input)
  return result.instance
}

describe('SaveStore', () => {
  describe('creation', () => {
    test('creates without id, generating a uuid, the slug and the defaults', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({
        name: 'Loja Meireles',
        latitude: -3.7247,
        longitude: -38.4968,
      })

      expect(result.isOk).toBe(true)
      const dto = result.instance
      expect(Id.isValid(dto.id)).toBe(true)
      expect(dto).toMatchObject({
        name: 'Loja Meireles',
        slug: 'loja-meireles',
        phone: null,
        address: null,
        latitude: -3.7247,
        longitude: -38.4968,
        deliveryRadiusMeters: 1000,
        isActive: true,
      })
      expect((await repository.findById(dto.id)).isOk).toBe(true)
    })

    test('creates with the given id, normalizing phone and coordinates', async () => {
      const { repository, useCase } = setup()
      const create = jest.spyOn(repository, 'create')
      const update = jest.spyOn(repository, 'update')

      const result = await useCase.execute({
        ...aldeota,
        id,
        latitude: -3.73561234,
        longitude: -38.50129876,
      })

      expect(result.instance).toMatchObject({
        id,
        slug: 'loja-aldeota',
        phone: '8530001001',
        latitude: -3.735612,
        longitude: -38.501299,
        deliveryRadiusMeters: 2500,
      })
      expect(create).toHaveBeenCalledWith(expect.any(Store))
      expect(update).not.toHaveBeenCalled()
      expect((await repository.findById(id)).instance.address).toBe(
        'Rua Silva Paulet, 1100 – Aldeota, Fortaleza/CE',
      )
    })

    test('fails with STORE_NAME_ALREADY_EXISTS for the same name in another case', async () => {
      const { repository, useCase } = setup()
      await createStore(useCase)

      const result = await useCase.execute({
        ...aldeota,
        name: 'LOJA ALDEOTA',
        slug: 'loja-aldeota-2',
      })

      expect(result.errors).toEqual(['STORE_NAME_ALREADY_EXISTS'])
      expect(repository.size).toBe(1)
    })

    test('fails with STORE_SLUG_ALREADY_EXISTS for a used slug', async () => {
      const { repository, useCase } = setup()
      await createStore(useCase)

      const result = await useCase.execute({
        name: 'Loja Aldeota Norte',
        slug: 'loja-aldeota',
        latitude: -3.73,
        longitude: -38.5,
      })

      expect(result.errors).toEqual(['STORE_SLUG_ALREADY_EXISTS'])
      expect(repository.size).toBe(1)
    })

    test('keeps the name of a deleted store reserved', async () => {
      const { repository, useCase } = setup()
      const store = await createStore(useCase)
      await new DeleteStore(repository).execute({ id: store.id })

      const result = await useCase.execute(aldeota)

      expect(result.errors).toEqual(['STORE_NAME_ALREADY_EXISTS'])
      expect(repository.size).toBe(1)
    })

    test('fails with the GeoPoint codes and stores nothing for out-of-range coordinates', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({
        ...aldeota,
        latitude: 91,
        longitude: -181,
      })

      expect(result.errors).toEqual([
        'GEO_POINT_LATITUDE_INVALID',
        'GEO_POINT_LONGITUDE_INVALID',
      ])
      expect(repository.size).toBe(0)
    })

    test('fails with INVALID_ID for a malformed id', async () => {
      const { repository, useCase } = setup()

      const result = await useCase.execute({ ...aldeota, id: 'abc' })

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(repository.size).toBe(0)
    })

    test('accepts two stores whose delivery radii overlap', async () => {
      const { repository, useCase } = setup()
      await createStore(useCase)

      const result = await useCase.execute({
        name: 'Loja Meireles',
        latitude: -3.7247,
        longitude: -38.4968,
        deliveryRadiusMeters: 2000,
      })

      expect(result.isOk).toBe(true)
      expect(repository.size).toBe(2)
    })
  })

  describe('update', () => {
    test('keeps its own name and slug without conflict', async () => {
      const { repository, useCase } = setup()
      const store = await createStore(useCase)

      const result = await useCase.execute({
        ...aldeota,
        id: store.id,
        slug: 'loja-aldeota',
        deliveryRadiusMeters: 3000,
      })

      expect(result.isOk).toBe(true)
      expect(result.instance.deliveryRadiusMeters).toBe(3000)
      expect((await repository.findById(store.id)).instance.deliveryRadiusMeters).toBe(
        3000,
      )
      expect(repository.size).toBe(1)
    })

    test('keeps the current slug when slug is not sent', async () => {
      const { repository, useCase } = setup()
      const store = await createStore(useCase)

      const result = await useCase.execute({
        ...aldeota,
        id: store.id,
        name: 'Loja Aldeota Sul',
      })

      expect(result.instance).toMatchObject({
        name: 'Loja Aldeota Sul',
        slug: 'loja-aldeota',
      })
      expect((await repository.findBySlug('loja-aldeota')).instance?.name).toBe(
        'Loja Aldeota Sul',
      )
    })

    test('moves the point, changes the radius and clears phone and address', async () => {
      const { repository, useCase } = setup()
      const store = await createStore(useCase)

      const result = await useCase.execute({
        id: store.id,
        name: 'Loja Aldeota',
        phone: null,
        address: '',
        latitude: -3.73,
        longitude: -38.495,
        deliveryRadiusMeters: 3000,
      })

      expect(result.instance).toMatchObject({
        slug: 'loja-aldeota',
        phone: null,
        address: null,
        latitude: -3.73,
        longitude: -38.495,
        deliveryRadiusMeters: 3000,
      })
      const saved = (await repository.findById(store.id)).instance
      expect(saved.phone).toBeNull()
      expect(saved.address).toBeNull()
      expect(saved.latitude).toBe(-3.73)
    })

    test('keeps the current value of the fields that are not sent', async () => {
      const { useCase } = setup()
      const store = await createStore(useCase, { ...aldeota, isActive: false })

      const result = await useCase.execute({
        id: store.id,
        name: 'Loja Aldeota',
      } as SaveStoreInput)

      expect(result.instance).toMatchObject({
        phone: '8530001001',
        address: 'Rua Silva Paulet, 1100 – Aldeota, Fortaleza/CE',
        latitude: -3.7356,
        longitude: -38.5012,
        deliveryRadiusMeters: 2500,
        isActive: false,
      })
    })

    test('fails with STORE_NAME_ALREADY_EXISTS for the name of another store', async () => {
      const { repository, useCase } = setup()
      await createStore(useCase)
      const coco = await createStore(useCase, {
        name: 'Loja Cocó',
        latitude: -3.7475,
        longitude: -38.4839,
      })

      const result = await useCase.execute({
        id: coco.id,
        name: 'loja aldeota',
        latitude: -3.7475,
        longitude: -38.4839,
      })

      expect(result.errors).toEqual(['STORE_NAME_ALREADY_EXISTS'])
      expect((await repository.findById(coco.id)).instance.name).toBe('Loja Cocó')
    })

    test('refreshes updatedAt and keeps createdAt', async () => {
      const { useCase } = setup()
      const store = await createStore(useCase)
      await new Promise((resolve) => setTimeout(resolve, 5))

      const result = await useCase.execute({
        ...aldeota,
        id: store.id,
        deliveryRadiusMeters: 3000,
      })

      expect(result.instance.createdAt).toEqual(store.createdAt)
      expect(result.instance.updatedAt.getTime()).toBeGreaterThan(
        store.updatedAt.getTime(),
      )
    })

    test('fails with STORE_NOT_FOUND for the id of a deleted store', async () => {
      const { repository, useCase } = setup()
      const store = await createStore(useCase)
      await new DeleteStore(repository).execute({ id: store.id })

      const result = await useCase.execute({ ...aldeota, id: store.id })

      expect(result.errors).toEqual(['STORE_NOT_FOUND'])
      expect((await repository.findById(store.id)).isFailure).toBe(true)
    })

    test('propagates a findById failure other than STORE_NOT_FOUND', async () => {
      const { repository, useCase } = setup()
      jest.spyOn(repository, 'findById').mockResolvedValue(Result.fail('DB_ERROR'))

      const result = await useCase.execute({ ...aldeota, id })

      expect(result.errors).toEqual(['DB_ERROR'])
      expect(repository.size).toBe(0)
    })
  })
})
