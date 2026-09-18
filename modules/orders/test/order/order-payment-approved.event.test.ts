import {
  ORDER_STATUS_EVENT_TYPES,
  OrderPaymentApprovedEvent,
  OrderPaymentApprovedEventInput,
} from '../../src/order'

const orderId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const changedAt = new Date('2026-09-14T15:30:03.000Z')

function input(
  overrides: Partial<OrderPaymentApprovedEventInput> = {},
): OrderPaymentApprovedEventInput {
  return {
    orderId,
    customerId,
    previousStatus: 'PLACED',
    changedAt,
    transactionId: 'TX-9B2E7C1A',
    paymentMethod: 'SIMULATED',
    amountCents: 2098,
    ...overrides,
  }
}

describe('OrderPaymentApprovedEvent', () => {
  test('creates the order.payment-approved event of the order', () => {
    const result = OrderPaymentApprovedEvent.tryCreate(input())

    expect(result.isOk).toBe(true)
    expect(ORDER_STATUS_EVENT_TYPES.PAYMENT_APPROVED).toBe(
      'order.payment-approved',
    )
    expect(result.instance.type).toBe('order.payment-approved')
  })

  test('belongs to the order aggregate, with occurredAt equal to changedAt and empty metadata', () => {
    const event = OrderPaymentApprovedEvent.create(input())

    expect(event.aggregateType).toBe('Order')
    expect(event.aggregateId).toBe(orderId)
    expect(event.occurredAt).toEqual(changedAt)
    expect(event.metadata).toEqual({})
    expect(event.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  test('carries the common part and the data of the gateway', () => {
    const event = OrderPaymentApprovedEvent.create(input())

    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'PLACED',
      status: 'PAYMENT_APPROVED',
      changedAt: '2026-09-14T15:30:03.000Z',
      transactionId: 'TX-9B2E7C1A',
      paymentMethod: 'SIMULATED',
      amountCents: 2098,
    })
  })

  test('generates a different id for each event', () => {
    expect(OrderPaymentApprovedEvent.create(input()).id).not.toBe(
      OrderPaymentApprovedEvent.create(input()).id,
    )
  })

  test.each(['', 'abc'])('fails with INVALID_ID for the orderId %p', (value) => {
    const result = OrderPaymentApprovedEvent.tryCreate(input({ orderId: value }))

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['INVALID_ID'])
  })

  test('fails instead of throwing for an invalid changedAt', () => {
    const result = OrderPaymentApprovedEvent.tryCreate(
      input({ changedAt: new Date('invalid') }),
    )

    expect(result.isFailure).toBe(true)
  })

  test('create throws for an invalid changedAt', () => {
    expect(() =>
      OrderPaymentApprovedEvent.create(input({ changedAt: new Date('x') })),
    ).toThrow()
  })
})
