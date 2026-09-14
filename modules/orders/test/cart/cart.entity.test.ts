import {
  Cart,
  CartErrors,
  CartItemInputDTO,
  CartItemProps,
} from '../../src/cart'

const id = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const productA = '550e8400-e29b-41d4-a716-446655440000'
const productB = '11111111-2222-4333-8444-555555555555'
const productC = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const past = new Date('2026-01-01T00:00:00.000Z')

function productId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function manyItems(count: number): CartItemProps[] {
  return Array.from({ length: count }, (_, index) => ({
    productId: productId(index),
    quantity: 1,
  }))
}

function cart(items: CartItemProps[] = []): Cart {
  return Cart.create({ id, userId, items, createdAt: past, updatedAt: past })
}

describe('Cart', () => {
  test('creates with valid attributes keeping the order of the items', () => {
    const result = Cart.tryCreate({
      id,
      userId,
      items: [
        { productId: productB, quantity: 2 },
        { productId: productA, quantity: 1 },
      ],
    })

    expect(result.isOk).toBe(true)
    expect(result.instance.id).toBe(id)
    expect(result.instance.userId).toBe(userId)
    expect(result.instance.items).toEqual([
      { productId: productB, quantity: 2 },
      { productId: productA, quantity: 1 },
    ])
  })

  test('defaults the items to an empty list and generates the id', () => {
    const created = Cart.create({ userId })

    expect(created.items).toEqual([])
    expect(created.itemCount).toBe(0)
    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  test('normalizes the ids to lowercase', () => {
    const created = Cart.create({
      userId: userId.toUpperCase(),
      items: [{ productId: productC.toUpperCase(), quantity: 1 }],
    })

    expect(created.userId).toBe(userId)
    expect(created.items[0]!.productId).toBe(productC)
  })

  test.each([undefined, '', 'abc'])(
    'fails with INVALID_ID for the userId %p',
    (value) => {
      const result = Cart.tryCreate({ userId: value as unknown as string })

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['INVALID_ID'])
    },
  )

  test('fails with CART_ITEM_DUPLICATED for a repeated productId', () => {
    const result = Cart.tryCreate({
      userId,
      items: [
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
        { productId: productA.toUpperCase(), quantity: 2 },
      ],
    })

    expect(result.errors).toEqual([CartErrors.CART_ITEM_DUPLICATED])
  })

  test('fails with CART_ITEMS_LIMIT_EXCEEDED for 51 items', () => {
    const result = Cart.tryCreate({ userId, items: manyItems(51) })

    expect(result.errors).toEqual([CartErrors.CART_ITEMS_LIMIT_EXCEEDED])
  })

  test('accepts 50 items', () => {
    expect(Cart.tryCreate({ userId, items: manyItems(50) }).isOk).toBe(true)
  })

  test('fails with the item errors for an invalid item', () => {
    const result = Cart.tryCreate({
      userId,
      items: [
        { productId: productA, quantity: 100 },
        { productId: 'abc', quantity: 1 },
      ],
    })

    expect(result.errors).toEqual([
      CartErrors.CART_ITEM_QUANTITY_INVALID,
      'INVALID_ID',
    ])
  })

  test('create throws on invalid props', () => {
    expect(() => Cart.create({ userId: 'abc' })).toThrow()
  })

  describe('addItem', () => {
    test('sums the quantity of a product already in the cart keeping its position', () => {
      const current = cart([
        { productId: productA, quantity: 2 },
        { productId: productB, quantity: 1 },
      ])

      const result = current.addItem(productA, 3)

      expect(result.isOk).toBe(true)
      expect(result.instance.items).toEqual([
        { productId: productA, quantity: 5 },
        { productId: productB, quantity: 1 },
      ])
      expect(result.instance.id).toBe(id)
      expect(result.instance.updatedAt.getTime()).toBeGreaterThan(past.getTime())
      expect(current.quantityOf(productA)).toBe(2)
    })

    test('adds a new product at the end', () => {
      const current = cart([{ productId: productA, quantity: 2 }])

      const result = current.addItem(productB, 1)

      expect(result.instance.items).toEqual([
        { productId: productA, quantity: 2 },
        { productId: productB, quantity: 1 },
      ])
    })

    test('accepts a sum of exactly 99', () => {
      const current = cart([{ productId: productA, quantity: 1 }])

      expect(current.addItem(productA, 98).instance.quantityOf(productA)).toBe(99)
    })

    test('fails with CART_ITEM_QUANTITY_EXCEEDED for a sum above 99', () => {
      const current = cart([{ productId: productA, quantity: 1 }])

      const result = current.addItem(productA, 99)

      expect(result.errors).toEqual([CartErrors.CART_ITEM_QUANTITY_EXCEEDED])
      expect(current.quantityOf(productA)).toBe(1)
    })

    test.each([0, 100, 1.5])(
      'fails with CART_ITEM_QUANTITY_INVALID for the quantity %p',
      (quantity) => {
        expect(cart().addItem(productA, quantity).errors).toEqual([
          CartErrors.CART_ITEM_QUANTITY_INVALID,
        ])
      },
    )

    test('fails with INVALID_ID for a malformed productId', () => {
      expect(cart().addItem('abc', 1).errors).toEqual(['INVALID_ID'])
    })

    test('fails with CART_ITEMS_LIMIT_EXCEEDED for the 51st product', () => {
      const current = cart(manyItems(50))

      const result = current.addItem(productA, 1)

      expect(result.errors).toEqual([CartErrors.CART_ITEMS_LIMIT_EXCEEDED])
      expect(current.items).toHaveLength(50)
    })
  })

  describe('setItemQuantity', () => {
    test('replaces the quantity keeping the position', () => {
      const current = cart([
        { productId: productA, quantity: 5 },
        { productId: productB, quantity: 1 },
      ])

      const result = current.setItemQuantity(productA, 1)

      expect(result.instance.items).toEqual([
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
      ])
      expect(result.instance.updatedAt.getTime()).toBeGreaterThan(past.getTime())
    })

    test('includes a product that is not in the cart at the end', () => {
      const current = cart([
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
      ])

      const result = current.setItemQuantity(productC, 2)

      expect(result.instance.items).toEqual([
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
        { productId: productC, quantity: 2 },
      ])
    })

    test.each([0, 100, 1.5])(
      'fails with CART_ITEM_QUANTITY_INVALID for the quantity %p',
      (quantity) => {
        const current = cart([{ productId: productA, quantity: 1 }])

        expect(current.setItemQuantity(productA, quantity).errors).toEqual([
          CartErrors.CART_ITEM_QUANTITY_INVALID,
        ])
      },
    )

    test('fails with CART_ITEMS_LIMIT_EXCEEDED for the 51st product', () => {
      expect(cart(manyItems(50)).setItemQuantity(productA, 1).errors).toEqual([
        CartErrors.CART_ITEMS_LIMIT_EXCEEDED,
      ])
    })
  })

  describe('removeItem', () => {
    test('removes the product keeping the order of the others', () => {
      const current = cart([
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 2 },
        { productId: productC, quantity: 3 },
      ])

      const result = current.removeItem(productB)

      expect(result.instance.items).toEqual([
        { productId: productA, quantity: 1 },
        { productId: productC, quantity: 3 },
      ])
      expect(result.instance.updatedAt.getTime()).toBeGreaterThan(past.getTime())
    })

    test('returns the same cart without changing updatedAt for a product that is not in the cart', () => {
      const current = cart([{ productId: productA, quantity: 1 }])

      const result = current.removeItem(productB)

      expect(result.isOk).toBe(true)
      expect(result.instance).toBe(current)
      expect(result.instance.updatedAt).toEqual(past)
    })
  })

  test('clear removes every item keeping the cart', () => {
    const current = cart([
      { productId: productA, quantity: 1 },
      { productId: productB, quantity: 2 },
    ])

    const result = current.clear()

    expect(result.instance.items).toEqual([])
    expect(result.instance.id).toBe(id)
    expect(result.instance.userId).toBe(userId)
    expect(result.instance.updatedAt.getTime()).toBeGreaterThan(past.getTime())
    expect(current.items).toHaveLength(2)
  })

  describe('merge', () => {
    test('sums a product already in the cart limited to 99, keeping its position, and adds new ones at the end', () => {
      const current = cart([
        { productId: productA, quantity: 2 },
        { productId: productC, quantity: 1 },
      ])

      const result = current.merge([
        { productId: productA, quantity: 98 },
        { productId: productB, quantity: 1 },
        { productId: productC, quantity: 150 },
      ])

      expect(result.isOk).toBe(true)
      expect(result.instance.items).toEqual([
        { productId: productA, quantity: 99 },
        { productId: productC, quantity: 99 },
        { productId: productB, quantity: 1 },
      ])
      expect(result.instance.updatedAt.getTime()).toBeGreaterThan(past.getTime())
    })

    test('adds the new products in the received order', () => {
      const result = cart().merge([
        { productId: productC, quantity: 1 },
        { productId: productA, quantity: 2 },
      ])

      expect(result.instance.items).toEqual([
        { productId: productC, quantity: 1 },
        { productId: productA, quantity: 2 },
      ])
    })

    test('ignores the new products beyond 50 but still sums the existing ones', () => {
      const current = cart(manyItems(49))

      const result = current.merge([
        { productId: productA, quantity: 1 },
        { productId: productB, quantity: 1 },
        { productId: productId(0), quantity: 2 },
      ])

      expect(result.isOk).toBe(true)
      const items = result.instance.items
      expect(items).toHaveLength(50)
      expect(items[49]).toEqual({ productId: productA, quantity: 1 })
      expect(result.instance.quantityOf(productB)).toBe(0)
      expect(result.instance.quantityOf(productId(0))).toBe(3)
    })

    test('ignores entries with an invalid quantity or a malformed productId', () => {
      const current = cart([{ productId: productA, quantity: 1 }])

      const result = current.merge([
        { productId: productA, quantity: 0 },
        { productId: productB, quantity: 1.5 },
        { productId: productC, quantity: 'abc' as unknown as number },
        { productId: 'abc', quantity: 1 },
        { productId: productB, quantity: -2 },
        { productId: productC, quantity: 2 },
      ])

      expect(result.instance.items).toEqual([
        { productId: productA, quantity: 1 },
        { productId: productC, quantity: 2 },
      ])
    })

    test('sums repeated entries limited to 99', () => {
      const result = cart().merge([
        { productId: productA, quantity: 60 },
        { productId: productB, quantity: 1 },
        { productId: productA.toUpperCase(), quantity: 60 },
      ])

      expect(result.instance.items).toEqual([
        { productId: productA, quantity: 99 },
        { productId: productB, quantity: 1 },
      ])
    })

    test('never fails because of the items', () => {
      const current = cart([{ productId: productA, quantity: 1 }])

      for (const items of [undefined, null, 'abc', [null], [{}]]) {
        const result = current.merge(items as unknown as CartItemInputDTO[])

        expect(result.isOk).toBe(true)
        expect(result.instance.items).toEqual([
          { productId: productA, quantity: 1 },
        ])
      }
    })
  })

  test('mergeableItems discards invalid entries, sums repeated ones and limits to 99', () => {
    expect(
      Cart.mergeableItems([
        { productId: productB.toUpperCase(), quantity: 2 },
        { productId: 'abc', quantity: 1 },
        { productId: productA, quantity: 0 },
        { productId: productA, quantity: 150 },
        { productId: productB, quantity: 3 },
      ]),
    ).toEqual([
      { productId: productB, quantity: 5 },
      { productId: productA, quantity: 99 },
    ])
  })

  test('itemCount sums the quantities and quantityOf returns 0 for an absent product', () => {
    const current = cart([
      { productId: productA, quantity: 2 },
      { productId: productB, quantity: 3 },
    ])

    expect(current.itemCount).toBe(5)
    expect(current.quantityOf(productA)).toBe(2)
    expect(current.quantityOf(productB.toUpperCase())).toBe(3)
    expect(current.quantityOf(productC)).toBe(0)
    expect(cart().itemCount).toBe(0)
    expect(cart().quantityOf(productA)).toBe(0)
  })

  test('items returns copies that do not change the entity', () => {
    const current = cart([{ productId: productA, quantity: 2 }])

    current.items[0]!.quantity = 50

    expect(current.quantityOf(productA)).toBe(2)
  })

  test('toDTO exposes exactly the public fields', () => {
    const current = cart([{ productId: productA, quantity: 2 }])

    expect(current.toDTO()).toEqual({
      id,
      userId,
      items: [{ productId: productA, quantity: 2 }],
      createdAt: past,
      updatedAt: past,
    })
  })

  test('equals compares by id', () => {
    expect(cart().equals(cart([{ productId: productA, quantity: 1 }]))).toBe(true)
    expect(cart().notEquals(Cart.create({ userId }))).toBe(true)
  })
})
