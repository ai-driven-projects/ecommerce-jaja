import {
  ORDER_STATUS_EVENT_TYPES,
  OrderDeliveredEvent,
  OrderDeliveredEventInput,
} from '../../src/order'

const orderId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const changedAt = new Date('2026-09-14T15:30:19.000Z')

function input(
  overrides: Partial<OrderDeliveredEventInput> = {},
): OrderDeliveredEventInput {
  return {
    orderId,
    customerId,
    previousStatus: 'OUT_FOR_DELIVERY',
    changedAt,
    receivedBy: 'Ana Pereira',
    ...overrides,
  }
}

describe('OrderDeliveredEvent', () => {
  test('creates the order.delivered event of the order', () => {
    const result = OrderDeliveredEvent.tryCreate(input())

    expect(result.isOk).toBe(true)
    expect(ORDER_STATUS_EVENT_TYPES.DELIVERED).toBe('order.delivered')
    expect(result.instance.type).toBe('order.delivered')
  })

  test('belongs to the order aggregate, with occurredAt equal to changedAt and empty metadata', () => {
    const event = OrderDeliveredEvent.create(input())

    expect(event.aggregateType).toBe('Order')
    expect(event.aggregateId).toBe(orderId)
    expect(event.occurredAt).toEqual(changedAt)
    expect(event.metadata).toEqual({})
  })

  test('carries the common part and who received the order', () => {
    const event = OrderDeliveredEvent.create(input())

    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'OUT_FOR_DELIVERY',
      status: 'DELIVERED',
      changedAt: '2026-09-14T15:30:19.000Z',
      receivedBy: 'Ana Pereira',
    })
  })

  test('generates a different id for each event', () => {
    expect(OrderDeliveredEvent.create(input()).id).not.toBe(
      OrderDeliveredEvent.create(input()).id,
    )
  })

  test.each(['', 'abc'])('fails with INVALID_ID for the orderId %p', (value) => {
    const result = OrderDeliveredEvent.tryCreate(input({ orderId: value }))

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails instead of throwing for an invalid changedAt', () => {
    const result = OrderDeliveredEvent.tryCreate(
      input({ changedAt: new Date('invalid') }),
    )

    expect(result.isFailure).toBe(true)
  })
})
