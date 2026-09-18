import {
  ORDER_STATUS_EVENT_TYPES,
  OrderOutForDeliveryEvent,
  OrderOutForDeliveryEventInput,
} from '../../src/order'

const orderId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const changedAt = new Date('2026-09-14T15:30:11.000Z')
const estimatedDeliveryAt = new Date('2026-09-14T15:45:11.000Z')

function input(
  overrides: Partial<OrderOutForDeliveryEventInput> = {},
): OrderOutForDeliveryEventInput {
  return {
    orderId,
    customerId,
    previousStatus: 'PICKING',
    changedAt,
    courierName: 'Entregador Simulado',
    trackingCode: 'JAJA-9B2E7C1A',
    estimatedDeliveryAt,
    ...overrides,
  }
}

describe('OrderOutForDeliveryEvent', () => {
  test('creates the order.out-for-delivery event of the order', () => {
    const result = OrderOutForDeliveryEvent.tryCreate(input())

    expect(result.isOk).toBe(true)
    expect(ORDER_STATUS_EVENT_TYPES.OUT_FOR_DELIVERY).toBe(
      'order.out-for-delivery',
    )
    expect(result.instance.type).toBe('order.out-for-delivery')
  })

  test('belongs to the order aggregate, with occurredAt equal to changedAt and empty metadata', () => {
    const event = OrderOutForDeliveryEvent.create(input())

    expect(event.aggregateType).toBe('Order')
    expect(event.aggregateId).toBe(orderId)
    expect(event.occurredAt).toEqual(changedAt)
    expect(event.metadata).toEqual({})
  })

  test('carries the common part, the courier, the tracking code and the estimate in ISO', () => {
    const event = OrderOutForDeliveryEvent.create(input())

    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'PICKING',
      status: 'OUT_FOR_DELIVERY',
      changedAt: '2026-09-14T15:30:11.000Z',
      courierName: 'Entregador Simulado',
      trackingCode: 'JAJA-9B2E7C1A',
      estimatedDeliveryAt: '2026-09-14T15:45:11.000Z',
    })
  })

  test('generates a different id for each event', () => {
    expect(OrderOutForDeliveryEvent.create(input()).id).not.toBe(
      OrderOutForDeliveryEvent.create(input()).id,
    )
  })

  test.each(['', 'abc'])('fails with INVALID_ID for the orderId %p', (value) => {
    const result = OrderOutForDeliveryEvent.tryCreate(input({ orderId: value }))

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test.each(['changedAt', 'estimatedDeliveryAt'] as const)(
    'fails instead of throwing for an invalid %s',
    (field) => {
      const result = OrderOutForDeliveryEvent.tryCreate(
        input({ [field]: new Date('invalid') }),
      )

      expect(result.isFailure).toBe(true)
    },
  )
})
