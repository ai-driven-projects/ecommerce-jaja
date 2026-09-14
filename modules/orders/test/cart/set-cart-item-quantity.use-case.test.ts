
import {
  Cart,
  CartErrors,
  CartItemProps,
  SetCartItemQuantity,
  SetCartItemQuantityInput,
} from '../../src/cart'
import { InMemoryCartRepository } from '../mock/in-memory-cart.repository'
import { InMemoryFindAvailableProductIdsQuery } from '../mock/in-memory-find-available-product-ids.query'

const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const productA = '550e8400-e29b-41d4-a716-446655440000'
const productB = '11111111-2222-4333-8444-555555555555'
const productC = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

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
  const useCase = new SetCartItemQuantity(repository, availability)
  if (items) await repository.create(Cart.create({ userId, items }))
  return { repository, availability, useCase }
}

function input(
  overrides: Partial<SetCartItemQuantityInput> = {},
): SetCartItemQuantityInput {
  return { userId, productId: productA, quantity: 1, ...overrides }
}

async function storedCart(repository: InMemoryCartRepository) {
  return (await repository.findByUserId(userId)).instance
}

describe('SetCartItemQuantity', () => {
  test('creates the cart when the user has none', async () => {
    const { repository, availability, useCase } = await setup()

    const result = await useCase.execute(input({ quantity: 4 }))

    expect(result.isOk).toBe(true)
    expect(repository.size).toBe(1)
    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 4 },
    ])
    expect(availability.calls).toEqual([[productA]])
  })

  test('includes a product that is not in the cart at the end', async () => {
    const { repository, useCase } = await setup({
      items: [
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
      ],
    })

    const result = await useCase.execute(
      input({ productId: productC, quantity: 2 }),
    )

    expect(result.isOk).toBe(true)
    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 1 },
      { productId: productB, quantity: 1 },
      { productId: productC, quantity: 2 },
    ])
  })

  test('changes the quantity keeping the position', async () => {
    const { repository, useCase } = await setup({
      items: [
        { productId: productA, quantity: 5 },
        { productId: productB, quantity: 1 },
      ],
    })
    const create = jest.spyOn(repository, 'create')

    const result = await useCase.execute(input({ quantity: 1 }))

    expect(result.isOk).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 1 },
      { productId: productB, quantity: 1 },
    ])
  })

  test('fails with CART_PRODUCT_NOT_FOUND for an unavailable product already in the cart', async () => {
    const { repository, useCase } = await setup({
      available: [productA],
      items: [
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 2 },
      ],
    })
    const update = jest.spyOn(repository, 'update')

    const result = await useCase.execute(
      input({ productId: productB, quantity: 3 }),
    )

    expect(result.errors).toEqual([CartErrors.CART_PRODUCT_NOT_FOUND])
    expect(update).not.toHaveBeenCalled()
    expect((await storedCart(repository))!.quantityOf(productB)).toBe(2)
  })

  test.each([0, 100, 1.5, 'abc'])(
    'fails with CART_ITEM_QUANTITY_INVALID for the quantity %p without checking the availability',
    async (quantity) => {
      const { repository, availability, useCase } = await setup({
        items: [{ productId: productA, quantity: 1 }],
      })

      const result = await useCase.execute(
        input({ quantity: quantity as unknown as number }),
      )

      expect(result.errors).toEqual([CartErrors.CART_ITEM_QUANTITY_INVALID])
      expect(availability.callCount).toBe(0)
      expect((await storedCart(repository))!.quantityOf(productA)).toBe(1)
    },
  )

  test('fails with INVALID_ID for a malformed productId without checking the availability', async () => {
    const { availability, useCase } = await setup()

    const result = await useCase.execute(input({ productId: 'abc' }))

    expect(result.errors).toEqual(['INVALID_ID'])
    expect(availability.callCount).toBe(0)
  })

  test('fails with CART_ITEMS_LIMIT_EXCEEDED for the 51st product', async () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      productId: productId(index),
      quantity: 1,
    }))
    const { repository, useCase } = await setup({
      available: [productId(50)],
      items,
    })

    const result = await useCase.execute(input({ productId: productId(50) }))

    expect(result.errors).toEqual([CartErrors.CART_ITEMS_LIMIT_EXCEEDED])
    expect((await storedCart(repository))!.items).toHaveLength(50)
  })

  test.each([undefined, '', 'abc'])(
    'fails with INVALID_ID for the userId %p',
    async (value) => {
      const { repository, availability, useCase } = await setup()

      const result = await useCase.execute(
        input({ userId: value as unknown as string }),
      )

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(availability.callCount).toBe(0)
      expect(repository.size).toBe(0)
    },
  )
})
