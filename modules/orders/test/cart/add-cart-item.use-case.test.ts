import { Id, Result } from '@mentoria-360/shared'
import {
  AddCartItem,
  AddCartItemInput,
  Cart,
  CartErrors,
  CartItemProps,
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
  const useCase = new AddCartItem(repository, availability)
  if (items) await repository.create(Cart.create({ userId, items }))
  return { repository, availability, useCase }
}

function input(overrides: Partial<AddCartItemInput> = {}): AddCartItemInput {
  return { userId, productId: productA, quantity: 1, ...overrides }
}

async function storedCart(repository: InMemoryCartRepository) {
  return (await repository.findByUserId(userId)).instance
}

describe('AddCartItem', () => {
  test('creates the cart on the first item', async () => {
    const { repository, availability, useCase } = await setup()

    const result = await useCase.execute(input({ quantity: 2 }))

    expect(result.isOk).toBe(true)
    expect(repository.size).toBe(1)
    const cart = await storedCart(repository)
    expect(Id.isValid(cart!.id)).toBe(true)
    expect(cart!.items).toEqual([{ productId: productA, quantity: 2 }])
    expect(availability.calls).toEqual([[productA]])
  })

  test('sums the quantity of the same product keeping its position', async () => {
    const { repository, useCase } = await setup({
      items: [
        { productId: productA, quantity: 2 },
        { productId: productB, quantity: 1 },
      ],
    })
    const create = jest.spyOn(repository, 'create')

    const result = await useCase.execute(input({ quantity: 3 }))

    expect(result.isOk).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect(repository.size).toBe(1)
    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 5 },
      { productId: productB, quantity: 1 },
    ])
  })

  test('adds a new product at the end', async () => {
    const { repository, useCase } = await setup({
      items: [{ productId: productA, quantity: 2 }],
    })

    await useCase.execute(input({ productId: productB }))

    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 2 },
      { productId: productB, quantity: 1 },
    ])
  })

  test('fails with CART_PRODUCT_NOT_FOUND for an unavailable product without creating a cart', async () => {
    const { repository, useCase } = await setup({ available: [productB] })

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([CartErrors.CART_PRODUCT_NOT_FOUND])
    expect(repository.size).toBe(0)
  })

  test('keeps the cart unchanged for an unavailable product', async () => {
    const { repository, useCase } = await setup({
      available: [],
      items: [{ productId: productA, quantity: 1 }],
    })
    const update = jest.spyOn(repository, 'update')

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([CartErrors.CART_PRODUCT_NOT_FOUND])
    expect(update).not.toHaveBeenCalled()
    expect((await storedCart(repository))!.quantityOf(productA)).toBe(1)
  })

  test.each([0, 100, 1.5, 'abc'])(
    'fails with CART_ITEM_QUANTITY_INVALID for the quantity %p without checking the availability',
    async (quantity) => {
      const { repository, availability, useCase } = await setup()

      const result = await useCase.execute(
        input({ quantity: quantity as unknown as number }),
      )

      expect(result.errors).toEqual([CartErrors.CART_ITEM_QUANTITY_INVALID])
      expect(availability.callCount).toBe(0)
      expect(repository.size).toBe(0)
    },
  )

  test('fails with INVALID_ID for a malformed productId without checking the availability', async () => {
    const { repository, availability, useCase } = await setup()

    const result = await useCase.execute(input({ productId: 'abc' }))

    expect(result.errors).toEqual(['INVALID_ID'])
    expect(availability.callCount).toBe(0)
    expect(repository.size).toBe(0)
  })

  test('fails with CART_ITEM_QUANTITY_EXCEEDED when the sum passes 99', async () => {
    const { repository, useCase } = await setup({
      items: [{ productId: productA, quantity: 1 }],
    })

    const result = await useCase.execute(input({ quantity: 99 }))

    expect(result.errors).toEqual([CartErrors.CART_ITEM_QUANTITY_EXCEEDED])
    expect((await storedCart(repository))!.quantityOf(productA)).toBe(1)
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

  test('propagates an availability failure', async () => {
    const { repository, availability, useCase } = await setup()
    jest
      .spyOn(availability, 'execute')
      .mockResolvedValue(Result.fail('DB_ERROR'))

    const result = await useCase.execute(input())

    expect(result.errors).toEqual(['DB_ERROR'])
    expect(repository.size).toBe(0)
  })

  test('propagates a create failure', async () => {
    const { repository, useCase } = await setup()
    jest
      .spyOn(repository, 'create')
      .mockResolvedValue(Result.fail(CartErrors.CART_ALREADY_EXISTS))

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([CartErrors.CART_ALREADY_EXISTS])
  })
})
