import {
  CompleteOrderDelivery,
  CompleteOrderDeliveryInputDTO,
  OrderDeliveredEvent,
  OrderErrors,
  OrderStatus,
} from '../../src/order'
import {
  customerId,
  orderId,
  recipientName,
  setupStep,
} from './order-step.fixture'

async function setup(status: OrderStatus | null = 'OUT_FOR_DELIVERY') {
  return setupStep<CompleteOrderDeliveryInputDTO>(
    (orders, events, transaction) =>
      new CompleteOrderDelivery(orders, events, transaction),
    status,
  )
}

function input(
  overrides: Partial<CompleteOrderDeliveryInputDTO> = {},
): CompleteOrderDeliveryInputDTO {
  return { orderId, receivedBy: 'Porteiro do prédio', ...overrides }
}

describe('CompleteOrderDelivery', () => {
  test('stores the delivered order and its event with the same tx in one transaction', async () => {
    const { useCase, orderRepository, domainEvents, transaction } =
      await setup()

    const result = await useCase.execute(input())

    expect(result.instance).toEqual({ status: 'DELIVERED', changed: true })

    const order = orderRepository.findStored(orderId)!
    expect(order.status).toBe('DELIVERED')
    expect(order.deliveredAt).not.toBeNull()

    expect(domainEvents.events).toHaveLength(1)
    const event = domainEvents.events[0]!
    expect(event).toBeInstanceOf(OrderDeliveredEvent)
    expect(event.type).toBe('order.delivered')
    expect(event.occurredAt).toEqual(order.deliveredAt)
    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'OUT_FOR_DELIVERY',
      status: 'DELIVERED',
      changedAt: order.deliveredAt!.toISOString(),
      receivedBy: 'Porteiro do prédio',
    })

    expect(transaction.calls).toBe(1)
    expect(orderRepository.writes).toEqual([
      { operation: 'update', id: orderId, tx: transaction.context },
    ])
    expect(domainEvents.calls[0]!.tx).toBe(transaction.context)
  })

  test.each([undefined, null, ''])(
    'with receivedBy %p records the recipient of the order',
    async (receivedBy) => {
      const { useCase, domainEvents } = await setup()

      const result = await useCase.execute(input({ receivedBy }))

      expect(result.instance).toEqual({ status: 'DELIVERED', changed: true })
      expect(domainEvents.events[0]!.payload).toMatchObject({ receivedBy: recipientName })
    },
  )

  test('an order already delivered ends with changed false, without a transaction or event', async () => {
    const { useCase, orderRepository, domainEvents, transaction } =
      await setup('DELIVERED')

    const result = await useCase.execute(input())

    expect(result.instance).toEqual({ status: 'DELIVERED', changed: false })
    expect(transaction.calls).toBe(0)
    expect(orderRepository.writes).toEqual([])
    expect(domainEvents.calls).toHaveLength(0)
  })

  test.each(['PLACED', 'PAYMENT_APPROVED', 'PICKING'] as OrderStatus[])(
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

  test.each(['A', 'a'.repeat(101)])(
    'fails with ORDER_DELIVERY_DATA_INVALID for the receiver %p, without a transaction',
    async (receivedBy) => {
      const { useCase, orderRepository, domainEvents, transaction } =
        await setup()

      const result = await useCase.execute(input({ receivedBy }))

      expect(result.errors).toEqual([OrderErrors.ORDER_DELIVERY_DATA_INVALID])
      expect(transaction.calls).toBe(0)
      expect(domainEvents.calls).toHaveLength(0)
      expect(orderRepository.findStored(orderId)!.status).toBe(
        'OUT_FOR_DELIVERY',
      )
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
