import {
  OrderErrors,
  OrderPickingStartedEvent,
  OrderStatus,
  StartOrderPicking,
  StartOrderPickingInputDTO,
} from '../../src/order'
import { customerId, orderId, setupStep } from './order-step.fixture'

async function setup(status: OrderStatus | null = 'PAYMENT_APPROVED') {
  return setupStep<StartOrderPickingInputDTO>(
    (orders, events, transaction) =>
      new StartOrderPicking(orders, events, transaction),
    status,
  )
}

function input(
  overrides: Partial<StartOrderPickingInputDTO> = {},
): StartOrderPickingInputDTO {
  return { orderId, pickingListId: 'SEP-9B2E7C1A', ...overrides }
}

describe('StartOrderPicking', () => {
  test('stores the order in PICKING and its event with the same tx in one transaction', async () => {
    const { useCase, orderRepository, domainEvents, transaction } =
      await setup()

    const result = await useCase.execute(input())

    expect(result.instance).toEqual({ status: 'PICKING', changed: true })

    const order = orderRepository.findStored(orderId)!
    expect(order.status).toBe('PICKING')
    expect(order.pickingStartedAt).not.toBeNull()
    expect(order.updatedAt).toEqual(order.pickingStartedAt)

    expect(domainEvents.events).toHaveLength(1)
    const event = domainEvents.events[0]!
    expect(event).toBeInstanceOf(OrderPickingStartedEvent)
    expect(event.type).toBe('order.picking-started')
    expect(event.occurredAt).toEqual(order.pickingStartedAt)
    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'PAYMENT_APPROVED',
      status: 'PICKING',
      changedAt: order.pickingStartedAt!.toISOString(),
      pickingListId: 'SEP-9B2E7C1A',
      itemCount: order.itemCount,
    })

    expect(transaction.calls).toBe(1)
    expect(orderRepository.writes).toEqual([
      { operation: 'update', id: orderId, tx: transaction.context },
    ])
    expect(domainEvents.calls[0]!.tx).toBe(transaction.context)
  })

  test.each(['PICKING', 'OUT_FOR_DELIVERY', 'DELIVERED'] as OrderStatus[])(
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

  test('fails with ORDER_STATUS_TRANSITION_INVALID for an order that has not paid yet', async () => {
    const { useCase, orderRepository, domainEvents, transaction } =
      await setup('PLACED')

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([OrderErrors.ORDER_STATUS_TRANSITION_INVALID])
    expect(transaction.calls).toBe(0)
    expect(domainEvents.calls).toHaveLength(0)
    expect(orderRepository.findStored(orderId)!.status).toBe('PLACED')
  })

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

  test.each(['  ', 'x'.repeat(65), undefined])(
    'fails with ORDER_PICKING_DATA_INVALID for the picking list %p',
    async (pickingListId) => {
      const { useCase, orderRepository, domainEvents, transaction } =
        await setup()

      const result = await useCase.execute(
        input({ pickingListId: pickingListId as unknown as string }),
      )

      expect(result.errors).toEqual([OrderErrors.ORDER_PICKING_DATA_INVALID])
      expect(transaction.calls).toBe(0)
      expect(domainEvents.calls).toHaveLength(0)
      expect(orderRepository.findStored(orderId)!.status).toBe(
        'PAYMENT_APPROVED',
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
