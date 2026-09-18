import {
  DispatchOrder,
  DispatchOrderInputDTO,
  OrderErrors,
  OrderOutForDeliveryEvent,
  OrderStatus,
} from '../../src/order'
import { customerId, orderId, setupStep } from './order-step.fixture'

const estimatedDeliveryAt = new Date(Date.now() + 15 * 60 * 1000)

async function setup(status: OrderStatus | null = 'PICKING') {
  return setupStep<DispatchOrderInputDTO>(
    (orders, events, transaction) =>
      new DispatchOrder(orders, events, transaction),
    status,
  )
}

function input(
  overrides: Partial<DispatchOrderInputDTO> = {},
): DispatchOrderInputDTO {
  return {
    orderId,
    courierName: 'Entregador Simulado',
    trackingCode: 'JAJA-9B2E7C1A',
    estimatedDeliveryAt,
    ...overrides,
  }
}

describe('DispatchOrder', () => {
  test('stores the order in OUT_FOR_DELIVERY and its event with the same tx in one transaction', async () => {
    const { useCase, orderRepository, domainEvents, transaction } =
      await setup()

    const result = await useCase.execute(input())

    expect(result.instance).toEqual({
      status: 'OUT_FOR_DELIVERY',
      changed: true,
    })

    const order = orderRepository.findStored(orderId)!
    expect(order.status).toBe('OUT_FOR_DELIVERY')
    expect(order.outForDeliveryAt).not.toBeNull()

    expect(domainEvents.events).toHaveLength(1)
    const event = domainEvents.events[0]!
    expect(event).toBeInstanceOf(OrderOutForDeliveryEvent)
    expect(event.type).toBe('order.out-for-delivery')
    expect(event.occurredAt).toEqual(order.outForDeliveryAt)
    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'PICKING',
      status: 'OUT_FOR_DELIVERY',
      changedAt: order.outForDeliveryAt!.toISOString(),
      courierName: 'Entregador Simulado',
      trackingCode: 'JAJA-9B2E7C1A',
      estimatedDeliveryAt: estimatedDeliveryAt.toISOString(),
    })

    expect(transaction.calls).toBe(1)
    expect(orderRepository.writes).toEqual([
      { operation: 'update', id: orderId, tx: transaction.context },
    ])
    expect(domainEvents.calls[0]!.tx).toBe(transaction.context)
  })

  test.each(['OUT_FOR_DELIVERY', 'DELIVERED'] as OrderStatus[])(
    'an order in %s ends with changed false, without a transaction or event',
    async (status) => {
      const { useCase, orderRepository, domainEvents, transaction } =
        await setup(status)

      const result = await useCase.execute(input())

      expect(result.instance).toEqual({ status, changed: false })
      expect(transaction.calls).toBe(0)
      expect(orderRepository.writes).toEqual([])
      expect(domainEvents.calls).toHaveLength(0)
    },
  )

  test.each(['PLACED', 'PAYMENT_APPROVED'] as OrderStatus[])(
    'fails with ORDER_STATUS_TRANSITION_INVALID for an order in %s',
    async (status) => {
      const { useCase, orderRepository, domainEvents, transaction } =
        await setup(status)

      const result = await useCase.execute(input())

      expect(result.errors).toEqual([
        OrderErrors.ORDER_STATUS_TRANSITION_INVALID,
      ])
      expect(transaction.calls).toBe(0)
      expect(domainEvents.calls).toHaveLength(0)
      expect(orderRepository.findStored(orderId)!.status).toBe(status)
    },
  )

  test('fails with ORDER_NOT_FOUND for a missing order', async () => {
    const { useCase, transaction } = await setup(null)

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([OrderErrors.ORDER_NOT_FOUND])
    expect(transaction.calls).toBe(0)
  })

  test.each([undefined, '', 'abc'])(
    'fails with INVALID_ID for the orderId %p',
    async (value) => {
      const { useCase, transaction } = await setup()

      const result = await useCase.execute(
        input({ orderId: value as unknown as string }),
      )

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(transaction.calls).toBe(0)
    },
  )

  test.each([
    ['a courier with one letter', { courierName: 'J' }],
    ['a blank tracking code', { trackingCode: '  ' }],
    [
      'an estimate before the step',
      { estimatedDeliveryAt: new Date('2020-01-01T00:00:00.000Z') },
    ],
    ['an invalid estimate', { estimatedDeliveryAt: new Date('invalid') }],
  ])(
    'fails with ORDER_DISPATCH_DATA_INVALID for %s, without a transaction',
    async (_, overrides) => {
      const { useCase, orderRepository, domainEvents, transaction } =
        await setup()

      const result = await useCase.execute(
        input(overrides as Partial<DispatchOrderInputDTO>),
      )

      expect(result.errors).toEqual([OrderErrors.ORDER_DISPATCH_DATA_INVALID])
      expect(transaction.calls).toBe(0)
      expect(domainEvents.calls).toHaveLength(0)
      expect(orderRepository.findStored(orderId)!.status).toBe('PICKING')
    },
  )

  test('fails and rolls back when appending the event fails', async () => {
    const { useCase, domainEvents, transaction } = await setup()
    domainEvents.failWith('OUTBOX_APPEND_FAILED')

    const result = await useCase.execute(input())

    expect(result.errors).toEqual(['OUTBOX_APPEND_FAILED'])
    expect(transaction.rolledBack).toBe(true)
    expect(domainEvents.events).toHaveLength(0)
  })
})
