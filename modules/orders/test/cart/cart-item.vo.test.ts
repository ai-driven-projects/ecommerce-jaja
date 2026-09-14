import { CartErrors, CartItem } from '../../src/cart'

const productId = '550e8400-e29b-41d4-a716-446655440000'

describe('CartItem', () => {
  test('creates with valid attributes', () => {
    const result = CartItem.tryCreate({ productId, quantity: 2 })

    expect(result.isOk).toBe(true)
    expect(result.instance.productId).toBe(productId)
    expect(result.instance.quantity).toBe(2)
  })

  test('normalizes the productId to lowercase', () => {
    const item = CartItem.create({
      productId: ` ${productId.toUpperCase()} `,
      quantity: 1,
    })

    expect(item.productId).toBe(productId)
  })

  test.each([undefined, null, '', '   '])(
    'fails with INVALID_ID for a missing productId (%p)',
    (value) => {
      const result = CartItem.tryCreate({
        productId: value as unknown as string,
        quantity: 1,
      })

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['INVALID_ID'])
    },
  )

  test.each(['abc', 42])(
    'fails with INVALID_ID for a malformed productId (%p)',
    (value) => {
      const result = CartItem.tryCreate({
        productId: value as unknown as string,
        quantity: 1,
      })

      expect(result.errors).toEqual(['INVALID_ID'])
    },
  )

  test.each([1, 99])('accepts the quantity %p', (quantity) => {
    const result = CartItem.tryCreate({ productId, quantity })

    expect(result.isOk).toBe(true)
    expect(result.instance.quantity).toBe(quantity)
  })

  test.each([0, 100, 1.5, -1, 'abc', '2', undefined, null, Number.NaN])(
    'fails with CART_ITEM_QUANTITY_INVALID for the quantity %p',
    (quantity) => {
      const result = CartItem.tryCreate({
        productId,
        quantity: quantity as unknown as number,
      })

      expect(result.errors).toEqual([CartErrors.CART_ITEM_QUANTITY_INVALID])
    },
  )

  test('combines the errors of every invalid attribute', () => {
    const result = CartItem.tryCreate(
      undefined as unknown as { productId: string; quantity: number },
    )

    expect(result.errors).toEqual([
      'INVALID_ID',
      CartErrors.CART_ITEM_QUANTITY_INVALID,
    ])
  })

  test('withQuantity returns a new item of the same product', () => {
    const item = CartItem.create({ productId, quantity: 2 })

    const changed = item.withQuantity(99)

    expect(changed.isOk).toBe(true)
    expect(changed.instance).not.toBe(item)
    expect(changed.instance.productId).toBe(productId)
    expect(changed.instance.quantity).toBe(99)
    expect(item.quantity).toBe(2)
  })

  test.each([0, 100, 1.5])(
    'withQuantity fails with CART_ITEM_QUANTITY_INVALID for %p',
    (quantity) => {
      const item = CartItem.create({ productId, quantity: 2 })

      expect(item.withQuantity(quantity).errors).toEqual([
        CartErrors.CART_ITEM_QUANTITY_INVALID,
      ])
    },
  )

  test('equals compares product and quantity', () => {
    const item = CartItem.create({ productId, quantity: 2 })

    expect(item.equals(CartItem.create({ productId, quantity: 2 }))).toBe(true)
    expect(item.equals(item.withQuantity(3).instance)).toBe(false)
  })

  test('toProps and toDTO expose exactly the normalized fields', () => {
    const item = CartItem.create({ productId: productId.toUpperCase(), quantity: 3 })

    expect(item.toProps()).toEqual({ productId, quantity: 3 })
    expect(item.toDTO()).toEqual({ productId, quantity: 3 })
  })

  test('create throws on invalid props', () => {
    expect(() => CartItem.create({ productId, quantity: 0 })).toThrow()
  })
})
