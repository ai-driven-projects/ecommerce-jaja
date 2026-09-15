import {
  Order,
  OrderDeliveryAddressProps,
  OrderErrors,
  OrderItemProps,
  OrderPlacedEvent,
  OrderProps,
  PlaceOrderProps,
} from '../../src/order'

const id = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const productA = '550e8400-e29b-41d4-a716-446655440000'
const productB = '11111111-2222-4333-8444-555555555555'
const placedAt = new Date('2026-09-14T15:30:00.000Z')
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const address: OrderDeliveryAddressProps = {
  zipCode: '60150160',
  street: 'Rua Silva Paulet',
  number: '1200',
  complement: 'Apto 302',
  neighborhood: 'Aldeota',
  city: 'Fortaleza',
  state: 'CE',
}

function productId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
}

function item(overrides: Partial<OrderItemProps> = {}): OrderItemProps {
  return {
    productId: productA,
    name: 'Banana prata',
    unit: 'kg',
    thumbUrl: null,
    unitPriceCents: 799,
    quantity: 2,
    ...overrides,
  }
}

// Subtotal 2147: 799 x 2 + 549 x 1.
function twoItems(): OrderItemProps[] {
  return [
    item(),
    item({
      productId: productB,
      name: 'Leite integral',
      unit: 'litro',
      unitPriceCents: 549,
      quantity: 1,
    }),
  ]
}

function manyItems(count: number): OrderItemProps[] {
  return Array.from({ length: count }, (_, index) =>
    item({ productId: productId(index), quantity: 1 }),
  )
}

function stored(overrides: Partial<OrderProps> = {}): OrderProps {
  return {
    id,
    customerId,
    status: 'PLACED',
    items: twoItems(),
    deliveryAddress: address,
    recipientName: 'Ana Pereira',
    deliveryInstructions: 'Deixar na portaria',
    placedAt,
    createdAt: placedAt,
    updatedAt: placedAt,
    ...overrides,
  }
}

function placement(overrides: Partial<PlaceOrderProps> = {}): PlaceOrderProps {
  return {
    customerId,
    items: twoItems(),
    deliveryAddress: address,
    recipientName: 'Ana Pereira',
    deliveryInstructions: 'Deixar na portaria',
    ...overrides,
  }
}

describe('Order', () => {
  describe('place', () => {
    test('generates the id, PLACED and placedAt', () => {
      const before = Date.now()

      const result = Order.place(placement())

      expect(result.isOk).toBe(true)
      const order = result.instance
      expect(order.id).toMatch(uuidPattern)
      expect(order.status).toBe('PLACED')
      expect(order.placedAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(order.placedAt.getTime()).toBeLessThanOrEqual(Date.now())
      expect(order.createdAt).toEqual(order.placedAt)
      expect(order.customerId).toBe(customerId)
      expect(Order.place(placement()).instance.id).not.toBe(order.id)
    })

    test('adds exactly one OrderPlacedEvent with the expected payload', () => {
      const order = Order.place(placement()).instance

      expect(order.hasEvents()).toBe(true)
      const events = order.peekEvents()
      expect(events).toHaveLength(1)
      const event = events[0]!
      expect(event).toBeInstanceOf(OrderPlacedEvent)
      expect(event.type).toBe('order.placed')
      expect(event.aggregateType).toBe('Order')
      expect(event.aggregateId).toBe(order.id)
      expect(event.occurredAt).toEqual(order.placedAt)
      expect(event.metadata).toEqual({})
      expect(event.payload).toEqual({
        customerId,
        items: [
          {
            productId: productA,
            name: 'Banana prata',
            quantity: 2,
            unitPriceCents: 799,
            lineTotalCents: 1598,
          },
          {
            productId: productB,
            name: 'Leite integral',
            quantity: 1,
            unitPriceCents: 549,
            lineTotalCents: 549,
          },
        ],
        itemCount: 3,
        subtotalCents: 2147,
        deliveryFeeCents: 490,
        totalCents: 2637,
        placedAt: order.placedAt.toISOString(),
      })
    })

    test('pullEvents returns the event and empties the list', () => {
      const order = Order.place(placement()).instance

      const pulled = order.pullEvents()

      expect(pulled).toHaveLength(1)
      expect(pulled[0]!.type).toBe('order.placed')
      expect(order.hasEvents()).toBe(false)
      expect(order.pullEvents()).toEqual([])
    })

    test('normalizes the input like tryCreate', () => {
      const order = Order.place(
        placement({
          customerId: customerId.toUpperCase(),
          recipientName: '  Ana Pereira ',
          deliveryInstructions: '   ',
        }),
      ).instance

      expect(order.customerId).toBe(customerId)
      expect(order.recipientName).toBe('Ana Pereira')
      expect(order.deliveryInstructions).toBeNull()
    })

    test('fails without adding events for an invalid input', () => {
      const result = Order.place(placement({ items: [] }))

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual([OrderErrors.ORDER_ITEMS_REQUIRED])
    })

    test('the clone keeps the pending event', () => {
      const order = Order.place(placement()).instance

      const clone = order.cloneWith({ recipientName: 'Bruno Lima' })

      expect(clone.isOk).toBe(true)
      expect(clone.instance.recipientName).toBe('Bruno Lima')
      expect(clone.instance.peekEvents()).toHaveLength(1)
    })
  })

  describe('tryCreate (rehydration)', () => {
    test('restores a stored order without events', () => {
      const result = Order.tryCreate(stored())

      expect(result.isOk).toBe(true)
      const order = result.instance
      expect(order.id).toBe(id)
      expect(order.status).toBe('PLACED')
      expect(order.placedAt).toEqual(placedAt)
      expect(order.hasEvents()).toBe(false)
      expect(order.pullEvents()).toEqual([])
      expect(Order.create(stored()).peekEvents()).toEqual([])
    })

    test('keeps the items in the received order', () => {
      const order = Order.create(stored({ items: twoItems().reverse() }))

      expect(order.items.map((line) => line.productId)).toEqual([
        productB,
        productA,
      ])
    })

    test.each([undefined, []])(
      'fails with ORDER_ITEMS_REQUIRED for the items %p',
      (items) => {
        const result = Order.tryCreate(
          stored({ items: items as unknown as OrderItemProps[] }),
        )

        expect(result.errors).toEqual([OrderErrors.ORDER_ITEMS_REQUIRED])
      },
    )

    test('fails with ORDER_ITEMS_LIMIT_EXCEEDED for 51 items', () => {
      const result = Order.tryCreate(stored({ items: manyItems(51) }))

      expect(result.errors).toEqual([OrderErrors.ORDER_ITEMS_LIMIT_EXCEEDED])
    })

    test('accepts 50 items', () => {
      expect(Order.tryCreate(stored({ items: manyItems(50) })).isOk).toBe(true)
    })

    test('fails with ORDER_ITEM_DUPLICATED for a repeated productId', () => {
      const result = Order.tryCreate(
        stored({
          items: [
            item(),
            item({ productId: productB }),
            item({ productId: productA.toUpperCase(), quantity: 1 }),
          ],
        }),
      )

      expect(result.errors).toEqual([OrderErrors.ORDER_ITEM_DUPLICATED])
    })

    test('fails with the item errors for an invalid item', () => {
      const result = Order.tryCreate(
        stored({ items: [item({ quantity: 100 }), item({ productId: productB, unitPriceCents: 0 })] }),
      )

      expect(result.errors).toEqual([
        OrderErrors.ORDER_ITEM_QUANTITY_INVALID,
        OrderErrors.ORDER_ITEM_PRICE_INVALID,
      ])
    })

    test('fails with TEXT_TOO_SHORT for a recipientName of 1 character', () => {
      expect(Order.tryCreate(stored({ recipientName: ' A ' })).errors).toEqual([
        'TEXT_TOO_SHORT',
      ])
    })

    test('fails with TEXT_TOO_LONG for a recipientName above 100 characters', () => {
      expect(
        Order.tryCreate(stored({ recipientName: 'a'.repeat(101) })).errors,
      ).toEqual(['TEXT_TOO_LONG'])
    })

    test('accepts a recipientName of 2 and of 100 characters', () => {
      expect(Order.tryCreate(stored({ recipientName: 'Al' })).isOk).toBe(true)
      expect(
        Order.tryCreate(stored({ recipientName: 'a'.repeat(100) })).isOk,
      ).toBe(true)
    })

    test('fails with TEXT_TOO_LONG for instructions with 201 characters', () => {
      expect(
        Order.tryCreate(stored({ deliveryInstructions: 'a'.repeat(201) })).errors,
      ).toEqual(['TEXT_TOO_LONG'])
      expect(
        Order.tryCreate(stored({ deliveryInstructions: 'a'.repeat(200) })).isOk,
      ).toBe(true)
    })

    test.each([undefined, null, '', '   '])(
      'resolves the instructions %p to null',
      (deliveryInstructions) => {
        const order = Order.create(stored({ deliveryInstructions }))

        expect(order.deliveryInstructions).toBeNull()
      },
    )

    test.each(['DELIVERED', 'placed', undefined])(
      'fails with ORDER_STATUS_INVALID for the status %p',
      (status) => {
        const result = Order.tryCreate(
          stored({ status: status as unknown as 'PLACED' }),
        )

        expect(result.errors).toEqual([OrderErrors.ORDER_STATUS_INVALID])
      },
    )

    test.each([undefined, '', 'abc'])(
      'fails with INVALID_ID for the customerId %p',
      (value) => {
        const result = Order.tryCreate(
          stored({ customerId: value as unknown as string }),
        )

        expect(result.errors).toEqual(['INVALID_ID'])
      },
    )

    test('fails with ORDER_DELIVERY_ADDRESS_INVALID without an address', () => {
      const result = Order.tryCreate(
        stored({
          deliveryAddress: undefined as unknown as OrderDeliveryAddressProps,
        }),
      )

      expect(result.errors).toEqual([OrderErrors.ORDER_DELIVERY_ADDRESS_INVALID])
    })

    test.each([undefined, new Date('invalid')])(
      'fails with ORDER_STATUS_INVALID for the placedAt %p',
      (value) => {
        const result = Order.tryCreate(
          stored({ placedAt: value as unknown as Date }),
        )

        expect(result.errors).toEqual([OrderErrors.ORDER_STATUS_INVALID])
      },
    )

    test('reports each error code once', () => {
      const result = Order.tryCreate(
        stored({
          status: 'X' as unknown as 'PLACED',
          placedAt: undefined as unknown as Date,
        }),
      )

      expect(result.errors).toEqual([OrderErrors.ORDER_STATUS_INVALID])
    })

    test('create throws on invalid props', () => {
      expect(() => Order.create(stored({ items: [] }))).toThrow()
    })
  })

  describe('totals', () => {
    test('charges 490 of delivery below 7900', () => {
      const order = Order.create(
        stored({ items: [item({ unitPriceCents: 7899, quantity: 1 })] }),
      )

      expect(order.itemCount).toBe(1)
      expect(order.subtotalCents).toBe(7899)
      expect(order.deliveryFeeCents).toBe(490)
      expect(order.totalCents).toBe(8389)
    })

    test('delivers for free from 7900', () => {
      const order = Order.create(
        stored({
          items: [
            item({ unitPriceCents: 3950, quantity: 1 }),
            item({ productId: productB, unitPriceCents: 1975, quantity: 2 }),
          ],
        }),
      )

      expect(order.itemCount).toBe(3)
      expect(order.subtotalCents).toBe(7900)
      expect(order.deliveryFeeCents).toBe(0)
      expect(order.totalCents).toBe(7900)
    })

    test('sums the quantities and the line totals', () => {
      const order = Order.create(stored())

      expect(order.itemCount).toBe(3)
      expect(order.subtotalCents).toBe(2147)
      expect(order.deliveryFeeCents).toBe(490)
      expect(order.totalCents).toBe(2637)
    })
  })

  test('getters return copies that do not change the entity', () => {
    const order = Order.create(stored())

    order.placedAt.setFullYear(2000)

    expect(order.placedAt).toEqual(placedAt)
    expect(Object.isFrozen(order.items[0]!.value)).toBe(true)
  })

  test('toDTO exposes the fields and the totals', () => {
    expect(Order.create(stored()).toDTO()).toEqual({
      id,
      customerId,
      status: 'PLACED',
      items: [
        {
          productId: productA,
          name: 'Banana prata',
          unit: 'kg',
          thumbUrl: null,
          unitPriceCents: 799,
          quantity: 2,
          lineTotalCents: 1598,
        },
        {
          productId: productB,
          name: 'Leite integral',
          unit: 'litro',
          thumbUrl: null,
          unitPriceCents: 549,
          quantity: 1,
          lineTotalCents: 549,
        },
      ],
      deliveryAddress: address,
      recipientName: 'Ana Pereira',
      deliveryInstructions: 'Deixar na portaria',
      itemCount: 3,
      subtotalCents: 2147,
      deliveryFeeCents: 490,
      totalCents: 2637,
      placedAt,
      createdAt: placedAt,
      updatedAt: placedAt,
    })
  })

  test('equals compares by id', () => {
    expect(
      Order.create(stored()).equals(
        Order.create(stored({ recipientName: 'Bruno Lima' })),
      ),
    ).toBe(true)
    expect(Order.create(stored()).notEquals(Order.place(placement()).instance)).toBe(true)
  })
})
