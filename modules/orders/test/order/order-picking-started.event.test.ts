import {
  ORDER_STATUS_EVENT_TYPES,
  OrderPickingStartedEvent,
  OrderPickingStartedEventInput,
} from '../../src/order'

const orderId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const changedAt = new Date('2026-09-14T15:30:05.000Z')

function input(
  overrides: Partial<OrderPickingStartedEventInput> = {},
): OrderPickingStartedEventInput {
  return {
    orderId,
    customerId,
    previousStatus: 'PAYMENT_APPROVED',
    changedAt,
    pickingListId: 'SEP-9B2E7C1A',
    itemCount: 3,
    ...overrides,
  }
}

describe('OrderPickingStartedEvent', () => {
  test('creates the order.picking-started event of the order', () => {
    const result = OrderPickingStartedEvent.tryCreate(input())

    expect(result.isOk).toBe(true)
    expect(ORDER_STATUS_EVENT_TYPES.PICKING).toBe('order.picking-started')
    expect(result.instance.type).toBe('order.picking-started')
  })

  test('belongs to the order aggregate, with occurredAt equal to changedAt and empty metadata', () => {
    const event = OrderPickingStartedEvent.create(input())

    expect(event.aggregateType).toBe('Order')
    expect(event.aggregateId).toBe(orderId)
    expect(event.occurredAt).toEqual(changedAt)
    expect(event.metadata).toEqual({})
  })

  test('carries the common part, the picking list and the units', () => {
    const event = OrderPickingStartedEvent.create(input())

    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'PAYMENT_APPROVED',
      status: 'PICKING',
      changedAt: '2026-09-14T15:30:05.000Z',
      pickingListId: 'SEP-9B2E7C1A',
      itemCount: 3,
    })
  })

  test('generates a different id for each event', () => {
    expect(OrderPickingStartedEvent.create(input()).id).not.toBe(
      OrderPickingStartedEvent.create(input()).id,
    )
  })

  test.each(['', 'abc'])('fails with INVALID_ID for the orderId %p', (value) => {
    const result = OrderPickingStartedEvent.tryCreate(input({ orderId: value }))

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails instead of throwing for an invalid changedAt', () => {
    const result = OrderPickingStartedEvent.tryCreate(
      input({ changedAt: new Date('invalid') }),
    )

    expect(result.isFailure).toBe(true)
  })
})
