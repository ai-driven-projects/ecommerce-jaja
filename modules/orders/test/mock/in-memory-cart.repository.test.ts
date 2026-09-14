import { Cart } from '../../src/cart'
import { InMemoryCartRepository } from './in-memory-cart.repository'

const id = '550e8400-e29b-41d4-a716-446655440000'
const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const otherUserId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const productId = '11111111-2222-4333-8444-555555555555'

function cart(overrides: Partial<Parameters<typeof Cart.create>[0]> = {}) {
  return Cart.create({
    id,
    userId,
    items: [{ productId, quantity: 1 }],
    ...overrides,
  })
}

async function setup() {
  const repository = new InMemoryCartRepository()
  await repository.create(cart())
  return repository
}

describe('InMemoryCartRepository', () => {
  test('finds a stored cart by id and userId', async () => {
    const repository = await setup()

    expect((await repository.findById(id)).instance.id).toBe(id)
    expect((await repository.findByUserId(userId)).instance?.id).toBe(id)
  })

  test('resolves the userId lookup to null when missing', async () => {
    const repository = await setup()

    expect((await repository.findByUserId(otherUserId)).instance).toBeNull()
  })

  test('fails findById with CART_NOT_FOUND when missing', async () => {
    const repository = new InMemoryCartRepository()

    expect((await repository.findById(id)).errors).toEqual(['CART_NOT_FOUND'])
  })

  test('fails create with CART_NOT_FOUND for an existing id', async () => {
    const repository = await setup()

    const result = await repository.create(cart({ userId: otherUserId }))

    expect(result.errors).toEqual(['CART_NOT_FOUND'])
  })

  test('fails create with CART_ALREADY_EXISTS for a used userId', async () => {
    const repository = await setup()

    const result = await repository.create(cart({ id: undefined }))

    expect(result.errors).toEqual(['CART_ALREADY_EXISTS'])
    expect(repository.size).toBe(1)
  })

  test('update replaces the whole item list', async () => {
    const repository = await setup()
    const stored = (await repository.findById(id)).instance

    await repository.update(stored.clear().instance)

    expect((await repository.findById(id)).instance.items).toEqual([])
  })

  test('fails update and delete with CART_NOT_FOUND for a missing cart', async () => {
    const repository = new InMemoryCartRepository()

    expect((await repository.update(cart())).errors).toEqual(['CART_NOT_FOUND'])
    expect((await repository.delete(id)).errors).toEqual(['CART_NOT_FOUND'])
  })

  test('delete fills deletedAt and lookups ignore the deleted cart', async () => {
    const repository = await setup()

    expect((await repository.delete(id)).isOk).toBe(true)

    expect(repository.size).toBe(1)
    expect(repository.findStored(id)?.deletedAt).toBeInstanceOf(Date)
    expect((await repository.findById(id)).errors).toEqual(['CART_NOT_FOUND'])
    expect((await repository.findByUserId(userId)).instance).toBeNull()
    expect((await repository.update(cart())).errors).toEqual(['CART_NOT_FOUND'])
    expect((await repository.delete(id)).errors).toEqual(['CART_NOT_FOUND'])
  })

  test('keeps the userId of a deleted cart reserved', async () => {
    const repository = await setup()
    await repository.delete(id)

    const result = await repository.create(cart({ id: undefined }))

    expect(result.errors).toEqual(['CART_ALREADY_EXISTS'])
  })
})
