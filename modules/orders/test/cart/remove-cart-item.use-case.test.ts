import { Result } from '@mentoria-360/shared'
import {
  Cart,
  CartItemProps,
  RemoveCartItem,
  RemoveCartItemInput,
} from '../../src/cart'
import { InMemoryCartRepository } from '../mock/in-memory-cart.repository'

const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const productA = '550e8400-e29b-41d4-a716-446655440000'
const productB = '11111111-2222-4333-8444-555555555555'
const productC = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

async function setup(items?: CartItemProps[]) {
  const repository = new InMemoryCartRepository()
  const useCase = new RemoveCartItem(repository)
  if (items) await repository.create(Cart.create({ userId, items }))
  return { repository, useCase }
}

function input(
  overrides: Partial<RemoveCartItemInput> = {},
): RemoveCartItemInput {
  return { userId, productId: productB, ...overrides }
}

async function storedCart(repository: InMemoryCartRepository) {
  return (await repository.findByUserId(userId)).instance
}

describe('RemoveCartItem', () => {
  test('ends ok without a cart and persists nothing', async () => {
    const { repository, useCase } = await setup()
    const create = jest.spyOn(repository, 'create')
    const update = jest.spyOn(repository, 'update')

    const result = await useCase.execute(input())

    expect(result.isOk).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(repository.size).toBe(0)
  })

  test('ends ok without persisting when the product is not in the cart', async () => {
    const { repository, useCase } = await setup([
      { productId: productA, quantity: 1 },
    ])
    const update = jest.spyOn(repository, 'update')

    const result = await useCase.execute(input())

    expect(result.isOk).toBe(true)
    expect(update).not.toHaveBeenCalled()
    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 1 },
    ])
  })

  // The use case has no availability dependency: an unavailable product (B)
  // can always be removed.
  test('removes an unavailable product keeping the order of the others', async () => {
    const { repository, useCase } = await setup([
      { productId: productA, quantity: 1 },
      { productId: productB, quantity: 2 },
      { productId: productC, quantity: 3 },
    ])

    const result = await useCase.execute(input())

    expect(result.isOk).toBe(true)
    expect((await storedCart(repository))!.items).toEqual([
      { productId: productA, quantity: 1 },
      { productId: productC, quantity: 3 },
    ])
  })

  test('accepts the productId in uppercase', async () => {
    const { repository, useCase } = await setup([
      { productId: productB, quantity: 2 },
    ])

    await useCase.execute(input({ productId: productB.toUpperCase() }))

    expect((await storedCart(repository))!.items).toEqual([])
  })

  test.each([undefined, '', 'abc'])(
    'fails with INVALID_ID for the productId %p without looking up the cart',
    async (value) => {
      const { repository, useCase } = await setup([
        { productId: productB, quantity: 2 },
      ])
      const findByUserId = jest.spyOn(repository, 'findByUserId')

      const result = await useCase.execute(
        input({ productId: value as unknown as string }),
      )

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(findByUserId).not.toHaveBeenCalled()
    },
  )

  test.each([undefined, '', 'abc'])(
    'fails with INVALID_ID for the userId %p',
    async (value) => {
      const { useCase } = await setup()

      const result = await useCase.execute(
        input({ userId: value as unknown as string }),
      )

      expect(result.errors).toEqual(['INVALID_ID'])
    },
  )

  test('propagates an update failure', async () => {
    const { repository, useCase } = await setup([
      { productId: productB, quantity: 2 },
    ])
    jest.spyOn(repository, 'update').mockResolvedValue(Result.fail('DB_ERROR'))

    const result = await useCase.execute(input())

    expect(result.errors).toEqual(['DB_ERROR'])
  })
})
