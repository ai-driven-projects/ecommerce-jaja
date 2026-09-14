import { Result } from '@mentoria-360/shared'
import {
  Cart,
  CartItemInputDTO,
  CartItemProps,
  MergeCart,
} from '../../src/cart'
import { InMemoryCartRepository } from '../mock/in-memory-cart.repository'
import { InMemoryFindAvailableProductIdsQuery } from '../mock/in-memory-find-available-product-ids.query'

const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const productA = '550e8400-e29b-41d4-a716-446655440000'
const productB = '11111111-2222-4333-8444-555555555555'
const productC = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
// Exist in the catalog but are not visible (e.g. inactive), or do not exist.
const inactiveProduct = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff'
const missingProduct = 'cccccccc-dddd-4eee-8fff-000000000000'

function productId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

interface SetupOptions {
  available?: string[]
  items?: CartItemProps[]
}

async function setup({ available, items }: SetupOptions = {}) {
  const repository = new InMemoryCartRepository()
  const availability = new InMemoryFindAvailableProductIdsQuery(
    available ?? [productA, productB, productC],
  )
  const useCase = new MergeCart(repository, availability)
  if (items) await repository.create(Cart.create({ userId, items }))
  return { repository, availability, useCase }
}

async function storedCart(repository: InMemoryCartRepository) {
  return (await repository.findByUserId(userId)).instance
}

describe('MergeCart', () => {
  test('creates the cart when the user has none, with the items in the received order', async () => {
    const { repository, useCase } = await setup()

    const result = await useCase.execute({
      userId,
      items: [
        { productId: productB, quantity: 2 },
        { productId: productA, quantity: 1 },
      ],
    })

    expect(result.isOk).toBe(true)
    expect(repository.size).toBe(1)
    expect((await storedCart(repository))!.items).toEqual([
      { productId: productB, quantity: 2 },
      { productId: productA, quantity: 1 },
    ])
  })

  test('sums with the existing cart limited to 99, keeping the position', async () => {
    const { repository, useCase } = await setup({
      items: [{ productId: productA, quantity: 2 }],
    })
    const update = jest.spyOn(repository, 'update')

    const result = await useCase.execute({
      userId,
      items: [
        { productId: productA, quantity: 98 },
        { productId: productB, quantity: 1 },
      ],
    })

    expect(result.isOk).toBe(true)
    expect(update).toHaveBeenCalledTimes(1)
    expect(repository.size).toBe(1)
    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 99 },
      { productId: productB, quantity: 1 },
    ])
  })

  test('ignores unavailable products and invalid entries', async () => {
    const { repository, availability, useCase } = await setup({
      available: [productA, productC],
    })

    const result = await useCase.execute({
      userId,
      items: [
        { productId: productA, quantity: 1 },
        { productId: inactiveProduct, quantity: 1 },
        { productId: missingProduct, quantity: 1 },
        { productId: 'abc', quantity: 1 },
        { productId: productC, quantity: 0 },
      ],
    })

    expect(result.isOk).toBe(true)
    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 1 },
    ])
    expect(availability.calls).toEqual([
      [productA, inactiveProduct, missingProduct],
    ])
  })

  test('sums repeated products before merging, limited to 99', async () => {
    const { repository, availability, useCase } = await setup()

    await useCase.execute({
      userId,
      items: [
        { productId: productA, quantity: 1 },
        { productId: productC, quantity: 60 },
        { productId: productA, quantity: 2 },
        { productId: productC, quantity: 60 },
      ],
    })

    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 3 },
      { productId: productC, quantity: 99 },
    ])
    expect(availability.calls).toEqual([[productA, productC]])
  })

  test.each([
    ['an empty list', []],
    ['only discarded entries', [
      { productId: productA, quantity: 0 },
      { productId: 'abc', quantity: 1 },
    ]],
    ['a missing list', undefined],
  ])(
    'does not create a cart nor check the availability for %s',
    async (_, items) => {
      const { repository, availability, useCase } = await setup()
      const create = jest.spyOn(repository, 'create')

      const result = await useCase.execute({
        userId,
        items: items as unknown as CartItemInputDTO[],
      })

      expect(result.isOk).toBe(true)
      expect(create).not.toHaveBeenCalled()
      expect(repository.size).toBe(0)
      expect(availability.callCount).toBe(0)
    },
  )

  test('does not create a cart when every product is unavailable', async () => {
    const { repository, availability, useCase } = await setup({
      available: [],
    })

    const result = await useCase.execute({
      userId,
      items: [{ productId: inactiveProduct, quantity: 1 }],
    })

    expect(result.isOk).toBe(true)
    expect(repository.size).toBe(0)
    expect(availability.callCount).toBe(1)
  })

  test('keeps the existing cart untouched when no item is left', async () => {
    const { repository, useCase } = await setup({
      available: [],
      items: [{ productId: productA, quantity: 1 }],
    })
    const update = jest.spyOn(repository, 'update')

    const result = await useCase.execute({
      userId,
      items: [{ productId: productB, quantity: 1 }],
    })

    expect(result.isOk).toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  test('checks the availability of every product in a single call', async () => {
    const { availability, useCase } = await setup()

    await useCase.execute({
      userId,
      items: [
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
        { productId: productC, quantity: 1 },
      ],
    })

    expect(availability.callCount).toBe(1)
    expect(availability.calls[0]).toEqual([productA, productB, productC])
  })

  test('ignores the new products beyond 50', async () => {
    const items = Array.from({ length: 49 }, (_, index) => ({
      productId: productId(index),
      quantity: 1,
    }))
    const { repository, useCase } = await setup({ items })

    const result = await useCase.execute({
      userId,
      items: [
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
      ],
    })

    expect(result.isOk).toBe(true)
    const cart = (await storedCart(repository))!
    expect(cart.items).toHaveLength(50)
    expect(cart.items[49]).toEqual({ productId: productA, quantity: 1 })
    expect(cart.quantityOf(productB)).toBe(0)
  })

  test.each([undefined, '', 'abc'])(
    'fails with INVALID_ID for the userId %p',
    async (value) => {
      const { repository, availability, useCase } = await setup()

      const result = await useCase.execute({
        userId: value as unknown as string,
        items: [{ productId: productA, quantity: 1 }],
      })

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(availability.callCount).toBe(0)
      expect(repository.size).toBe(0)
    },
  )

  test('propagates an availability failure', async () => {
    const { repository, availability, useCase } = await setup()
    jest
      .spyOn(availability, 'execute')
      .mockResolvedValue(Result.fail('DB_ERROR'))

    const result = await useCase.execute({
      userId,
      items: [{ productId: productA, quantity: 1 }],
    })

    expect(result.errors).toEqual(['DB_ERROR'])
    expect(repository.size).toBe(0)
  })
})
