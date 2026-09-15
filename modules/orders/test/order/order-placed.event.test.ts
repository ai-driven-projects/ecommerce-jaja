import {
  ORDER_PLACED_EVENT_TYPE,
  OrderPlacedEvent,
  OrderPlacedEventInput,
} from '../../src/order'

const orderId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const productA = '550e8400-e29b-41d4-a716-446655440000'
const productB = '11111111-2222-4333-8444-555555555555'
const placedAt = new Date('2026-09-14T15:30:00.000Z')

function input(
  overrides: Partial<OrderPlacedEventInput> = {},
): OrderPlacedEventInput {
  return {
    orderId,
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
    placedAt,
    ...overrides,
  }
}

describe('OrderPlacedEvent', () => {
  test('creates the order.placed event of the order', () => {
    const result = OrderPlacedEvent.tryCreate(input())

    expect(result.isOk).toBe(true)
    const event = result.instance
    expect(ORDER_PLACED_EVENT_TYPE).toBe('order.placed')
    expect(event.type).toBe('order.placed')
    expect(event.aggregateType).toBe('Order')
    expect(event.aggregateId).toBe(orderId)
    expect(event.occurredAt).toEqual(placedAt)
    expect(event.metadata).toEqual({})
    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  test('carries the customer, the items, the totals and placedAt in ISO', () => {
    const event = OrderPlacedEvent.create(input())

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
      placedAt: '2026-09-14T15:30:00.000Z',
    })
  })

  test('copies only the item fields of the payload', () => {
    const item = {
      ...input().items[0]!,
      unit: 'kg',
      thumbUrl: 'https://cdn.jaja.dev/banana.webp',
    }

    const event = OrderPlacedEvent.create(input({ items: [item] }))

    expect(Object.keys(event.payload.items[0]!).sort()).toEqual([
      'lineTotalCents',
      'name',
      'productId',
      'quantity',
      'unitPriceCents',
    ])
  })

  test('generates a different id for each event', () => {
    expect(OrderPlacedEvent.create(input()).id).not.toBe(
      OrderPlacedEvent.create(input()).id,
    )
  })

  test.each(['', 'abc'])(
    'fails with INVALID_ID for the orderId %p',
    (value) => {
      const result = OrderPlacedEvent.tryCreate(input({ orderId: value }))

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual(['INVALID_ID'])
    },
  )

  test('fails instead of throwing for an invalid placedAt', () => {
    const result = OrderPlacedEvent.tryCreate(
      input({ placedAt: new Date('invalid') }),
    )

    expect(result.isFailure).toBe(true)
    expect(() => OrderPlacedEvent.create(input({ placedAt: new Date('x') }))).toThrow()
  })
})
