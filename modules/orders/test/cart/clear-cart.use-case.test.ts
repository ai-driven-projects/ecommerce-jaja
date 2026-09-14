import { Result } from '@mentoria-360/shared'
import { Cart, CartItemProps, ClearCart } from '../../src/cart'
import { InMemoryCartRepository } from '../mock/in-memory-cart.repository'

const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const productA = '550e8400-e29b-41d4-a716-446655440000'
const productB = '11111111-2222-4333-8444-555555555555'

async function setup(items?: CartItemProps[]) {
  const repository = new InMemoryCartRepository()
  const useCase = new ClearCart(repository)
  const cart = items ? Cart.create({ userId, items }) : null
  if (cart) await repository.create(cart)
  return { repository, useCase, cart }
}

describe('ClearCart', () => {
  test('ends ok without a cart and persists nothing', async () => {
    const { repository, useCase } = await setup()
    const create = jest.spyOn(repository, 'create')
    const update = jest.spyOn(repository, 'update')

    const result = await useCase.execute({ userId })

    expect(result.isOk).toBe(true)
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(repository.size).toBe(0)
  })

  test('ends ok without persisting an empty cart', async () => {
    const { repository, useCase } = await setup([])
    const update = jest.spyOn(repository, 'update')

    const result = await useCase.execute({ userId })

    expect(result.isOk).toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  test('removes every item keeping the cart', async () => {
    const { repository, useCase, cart } = await setup([
      { productId: productA, quantity: 1 },
      { productId: productB, quantity: 2 },
    ])
    const update = jest.spyOn(repository, 'update')

    const result = await useCase.execute({ userId })

    expect(result.isOk).toBe(true)
    expect(update).toHaveBeenCalledTimes(1)
    const stored = (await repository.findByUserId(userId)).instance
    expect(stored!.id).toBe(cart!.id)
    expect(stored!.items).toEqual([])
    expect(repository.size).toBe(1)
  })

  test.each([undefined, '', 'abc'])(
    'fails with INVALID_ID for the userId %p',
    async (value) => {
      const { repository, useCase } = await setup()
      const findByUserId = jest.spyOn(repository, 'findByUserId')

      const result = await useCase.execute({
        userId: value as unknown as string,
      })

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(findByUserId).not.toHaveBeenCalled()
    },
  )

  test('propagates a findByUserId failure', async () => {
    const { repository, useCase } = await setup()
    jest
      .spyOn(repository, 'findByUserId')
      .mockResolvedValue(Result.fail('DB_ERROR'))

    const result = await useCase.execute({ userId })

    expect(result.errors).toEqual(['DB_ERROR'])
  })
})
