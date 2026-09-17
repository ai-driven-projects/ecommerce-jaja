import {
  ORDER_STATUS_EVENT_TYPES,
  OrderErrors,
  OrderStatus,
  OrderStatusChangedEvent,
  OrderStatusChangedEventInput,
} from '../../src/order'

const orderId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const changedAt = new Date('2026-09-14T15:30:03.000Z')

function input(
  overrides: Partial<OrderStatusChangedEventInput> = {},
): OrderStatusChangedEventInput {
  return {
    orderId,
    customerId,
    previousStatus: 'PLACED',
    status: 'PAYMENT_APPROVED',
    changedAt,
    ...overrides,
  }
}

describe('OrderStatusChangedEvent', () => {
  test.each([
    ['PLACED', 'PAYMENT_APPROVED', 'order.payment-approved'],
    ['PAYMENT_APPROVED', 'PICKING', 'order.picking-started'],
    ['PICKING', 'OUT_FOR_DELIVERY', 'order.out-for-delivery'],
    ['OUT_FOR_DELIVERY', 'DELIVERED', 'order.delivered'],
  ] as [OrderStatus, OrderStatus, string][])(
    'from %s to %s has the type %s',
    (previousStatus, status, type) => {
      const result = OrderStatusChangedEvent.tryCreate(
        input({ previousStatus, status }),
      )

      expect(result.isOk).toBe(true)
      expect(result.instance.type).toBe(type)
      expect(ORDER_STATUS_EVENT_TYPES[status as 'DELIVERED']).toBe(type)
      expect(result.instance.payload.previousStatus).toBe(previousStatus)
      expect(result.instance.payload.status).toBe(status)
    },
  )

  test('belongs to the order aggregate, with occurredAt equal to changedAt and empty metadata', () => {
    const event = OrderStatusChangedEvent.create(input())

    expect(event.aggregateType).toBe('Order')
    expect(event.aggregateId).toBe(orderId)
    expect(event.occurredAt).toEqual(changedAt)
    expect(event.metadata).toEqual({})
    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  test('carries the customer, both statuses and changedAt in ISO', () => {
    const event = OrderStatusChangedEvent.create(
      input({ previousStatus: 'PICKING', status: 'OUT_FOR_DELIVERY' }),
    )

    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'PICKING',
      status: 'OUT_FOR_DELIVERY',
      changedAt: '2026-09-14T15:30:03.000Z',
    })
  })

  test('generates a different id for each event', () => {
    expect(OrderStatusChangedEvent.create(input()).id).not.toBe(
      OrderStatusChangedEvent.create(input()).id,
    )
  })

  test.each(['PLACED', 'CANCELLED', 'delivered', undefined])(
    'fails with ORDER_STATUS_INVALID for the status %p',
    (status) => {
      const result = OrderStatusChangedEvent.tryCreate(
        input({ status: status as unknown as OrderStatus }),
      )

      expect(result.isFailure).toBe(true)
      expect(result.errors).toEqual([OrderErrors.ORDER_STATUS_INVALID])
    },
  )

  test('create throws for an invalid status', () => {
    expect(() =>
      OrderStatusChangedEvent.create(input({ status: 'PLACED' })),
    ).toThrow()
  })

  test.each(['', 'abc'])('fails with INVALID_ID for the orderId %p', (value) => {
    const result = OrderStatusChangedEvent.tryCreate(input({ orderId: value }))

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails instead of throwing for an invalid changedAt', () => {
    const result = OrderStatusChangedEvent.tryCreate(
      input({ changedAt: new Date('invalid') }),
    )

    expect(result.isFailure).toBe(true)
  })
})
