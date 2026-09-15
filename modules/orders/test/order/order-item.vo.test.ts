import { OrderErrors, OrderItem, OrderItemProps } from '../../src/order'

const productId = '550e8400-e29b-41d4-a716-446655440000'
const thumbUrl = 'https://cdn.jaja.dev/products/banana-thumb.webp'

function props(overrides: Partial<OrderItemProps> = {}): OrderItemProps {
  return {
    productId,
    name: 'Banana prata',
    unit: 'kg',
    thumbUrl,
    unitPriceCents: 799,
    quantity: 2,
    ...overrides,
  }
}

describe('OrderItem', () => {
  test('creates with valid attributes', () => {
    const result = OrderItem.tryCreate(props())

    expect(result.isOk).toBe(true)
    expect(result.instance.productId).toBe(productId)
    expect(result.instance.name).toBe('Banana prata')
    expect(result.instance.unit).toBe('kg')
    expect(result.instance.thumbUrl).toBe(thumbUrl)
    expect(result.instance.unitPriceCents).toBe(799)
    expect(result.instance.quantity).toBe(2)
  })

  test('normalizes the productId to lowercase and trims the texts', () => {
    const item = OrderItem.create(
      props({
        productId: ` ${productId.toUpperCase()} `,
        name: '  Banana prata ',
        unit: ' kg ',
        thumbUrl: ` ${thumbUrl} `,
      }),
    )

    expect(item.productId).toBe(productId)
    expect(item.name).toBe('Banana prata')
    expect(item.unit).toBe('kg')
    expect(item.thumbUrl).toBe(thumbUrl)
  })

  test.each([undefined, '', 'abc', 42])(
    'fails with INVALID_ID for the productId %p',
    (value) => {
      const result = OrderItem.tryCreate(
        props({ productId: value as unknown as string }),
      )

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['INVALID_ID'])
    },
  )

  test.each(['', '   ', undefined])(
    'fails with TEXT_TOO_SHORT for the name %p',
    (name) => {
      const result = OrderItem.tryCreate(
        props({ name: name as unknown as string }),
      )

      expect(result.errors).toEqual(['TEXT_TOO_SHORT'])
    },
  )

  test('fails with TEXT_TOO_LONG for a name above 255 characters', () => {
    expect(OrderItem.tryCreate(props({ name: 'a'.repeat(256) })).errors).toEqual(
      ['TEXT_TOO_LONG'],
    )
    expect(OrderItem.tryCreate(props({ name: 'a'.repeat(255) })).isOk).toBe(true)
  })

  test('fails with the Text errors for an empty or too long unit', () => {
    expect(OrderItem.tryCreate(props({ unit: ' ' })).errors).toEqual([
      'TEXT_TOO_SHORT',
    ])
    expect(OrderItem.tryCreate(props({ unit: 'u'.repeat(41) })).errors).toEqual(
      ['TEXT_TOO_LONG'],
    )
  })

  test.each([undefined, null, '', '   '])(
    'resolves a missing thumbUrl (%p) to null',
    (value) => {
      const item = OrderItem.create(
        props({ thumbUrl: value as unknown as string }),
      )

      expect(item.thumbUrl).toBeNull()
      expect(item.toProps().thumbUrl).toBeNull()
      expect(item.toDTO().thumbUrl).toBeNull()
    },
  )

  test('fails with INVALID_URL for a malformed thumbUrl', () => {
    expect(
      OrderItem.tryCreate(props({ thumbUrl: 'not a url' })).errors,
    ).toEqual(['INVALID_URL'])
  })

  test.each([0, -1, 1.5, '799', undefined, null, Number.NaN])(
    'fails with ORDER_ITEM_PRICE_INVALID for the unit price %p',
    (unitPriceCents) => {
      const result = OrderItem.tryCreate(
        props({ unitPriceCents: unitPriceCents as unknown as number }),
      )

      expect(result.errors).toEqual([OrderErrors.ORDER_ITEM_PRICE_INVALID])
    },
  )

  test('accepts a unit price of 1 cent', () => {
    expect(OrderItem.tryCreate(props({ unitPriceCents: 1 })).isOk).toBe(true)
  })

  test.each([1, 99])('accepts the quantity %p', (quantity) => {
    expect(OrderItem.tryCreate(props({ quantity })).instance.quantity).toBe(
      quantity,
    )
  })

  test.each([0, 100, 1.5, '2', undefined])(
    'fails with ORDER_ITEM_QUANTITY_INVALID for the quantity %p',
    (quantity) => {
      const result = OrderItem.tryCreate(
        props({ quantity: quantity as unknown as number }),
      )

      expect(result.errors).toEqual([OrderErrors.ORDER_ITEM_QUANTITY_INVALID])
    },
  )

  test('combines the errors of every invalid attribute', () => {
    const result = OrderItem.tryCreate(
      undefined as unknown as OrderItemProps,
    )

    expect(result.errors).toEqual([
      'INVALID_ID',
      'TEXT_TOO_SHORT',
      'TEXT_TOO_SHORT',
      OrderErrors.ORDER_ITEM_PRICE_INVALID,
      OrderErrors.ORDER_ITEM_QUANTITY_INVALID,
    ])
  })

  test('lineTotalCents multiplies the unit price by the quantity', () => {
    expect(OrderItem.create(props()).lineTotalCents).toBe(1598)
    expect(
      OrderItem.create(props({ unitPriceCents: 1, quantity: 99 }))
        .lineTotalCents,
    ).toBe(99)
  })

  test('toProps and toDTO expose the normalized fields', () => {
    const item = OrderItem.create(props({ productId: productId.toUpperCase() }))

    expect(item.toProps()).toEqual({
      productId,
      name: 'Banana prata',
      unit: 'kg',
      thumbUrl,
      unitPriceCents: 799,
      quantity: 2,
    })
    expect(item.toDTO()).toEqual({
      productId,
      name: 'Banana prata',
      unit: 'kg',
      thumbUrl,
      unitPriceCents: 799,
      quantity: 2,
      lineTotalCents: 1598,
    })
  })

  test('equals compares every field', () => {
    const item = OrderItem.create(props())

    expect(item.equals(OrderItem.create(props()))).toBe(true)
    expect(item.equals(OrderItem.create(props({ quantity: 3 })))).toBe(false)
  })

  test('create throws on invalid props', () => {
    expect(() => OrderItem.create(props({ quantity: 0 }))).toThrow()
  })
})
