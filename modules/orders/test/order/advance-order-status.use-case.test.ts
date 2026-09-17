import { Result } from '@mentoria-360/shared'
import {
  AdvanceOrderStatus,
  AdvanceOrderStatusInputDTO,
  Order,
  OrderErrors,
  OrderProps,
  OrderStatus,
  OrderStatusChangedEvent,
} from '../../src/order'
import { FakeTransactionManager } from '../mock/fake-transaction.manager'
import { InMemoryDomainEventRepository } from '../mock/in-memory-domain-event.repository'
import { InMemoryOrderRepository } from '../mock/in-memory-order.repository'

const orderId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const placedAt = new Date('2026-09-14T15:30:00.000Z')
const paymentApprovedAt = new Date('2026-09-14T15:30:03.000Z')
const pickingStartedAt = new Date('2026-09-14T15:30:05.000Z')
const outForDeliveryAt = new Date('2026-09-14T15:30:11.000Z')
const deliveredAt = new Date('2026-09-14T15:30:19.000Z')

// The step dates of a stored order in `status`.
const STEP_DATES: Record<OrderStatus, Partial<OrderProps>> = {
  PLACED: {},
  PAYMENT_APPROVED: { paymentApprovedAt },
  PICKING: { paymentApprovedAt, pickingStartedAt },
  OUT_FOR_DELIVERY: { paymentApprovedAt, pickingStartedAt, outForDeliveryAt },
  DELIVERED: {
    paymentApprovedAt,
    pickingStartedAt,
    outForDeliveryAt,
    deliveredAt,
  },
}

function storedOrder(status: OrderStatus = 'PLACED'): Order {
  return Order.create({
    id: orderId,
    customerId,
    status,
    items: [
      {
        productId: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Banana prata',
        unit: 'kg',
        thumbUrl: null,
        unitPriceCents: 799,
        quantity: 2,
      },
    ],
    deliveryAddress: {
      zipCode: '60150160',
      street: 'Rua Silva Paulet',
      number: '1200',
      complement: null,
      neighborhood: 'Aldeota',
      city: 'Fortaleza',
      state: 'CE',
    },
    recipientName: 'Ana Pereira',
    deliveryInstructions: null,
    placedAt,
    createdAt: placedAt,
    updatedAt: placedAt,
    ...STEP_DATES[status],
  })
}

// `status` is the stored status of the order; `null` stores no order.
async function setup(status: OrderStatus | null = 'PLACED') {
  const orderRepository = new InMemoryOrderRepository()
  const domainEvents = new InMemoryDomainEventRepository()
  const transaction = new FakeTransactionManager()

  if (status) await orderRepository.create(storedOrder(status))
  // Only the writes of the use case matter to the tests.
  orderRepository.writes.length = 0

  const useCase = new AdvanceOrderStatus(
    orderRepository,
    domainEvents,
    transaction,
  )

  return { useCase, orderRepository, domainEvents, transaction }
}

function input(
  overrides: Partial<AdvanceOrderStatusInputDTO> = {},
): AdvanceOrderStatusInputDTO {
  return { orderId, status: 'PAYMENT_APPROVED', ...overrides }
}

describe('AdvanceOrderStatus', () => {
  test('stores the advanced order and its event with the same tx in one transaction', async () => {
    const { useCase, orderRepository, domainEvents, transaction } =
      await setup()
    const before = Date.now()

    const result = await useCase.execute(input())

    expect(result.isOk).toBe(true)
    expect(result.instance).toEqual({
      status: 'PAYMENT_APPROVED',
      changed: true,
    })

    const order = orderRepository.findStored(orderId)!
    expect(order.status).toBe('PAYMENT_APPROVED')
    expect(order.paymentApprovedAt!.getTime()).toBeGreaterThanOrEqual(before)
    expect(order.paymentApprovedAt!.getTime()).toBeLessThanOrEqual(Date.now())
    expect(order.updatedAt).toEqual(order.paymentApprovedAt)
    expect(order.pickingStartedAt).toBeNull()

    expect(domainEvents.events).toHaveLength(1)
    const event = domainEvents.events[0]!
    expect(event).toBeInstanceOf(OrderStatusChangedEvent)
    expect(event.type).toBe('order.payment-approved')
    expect(event.aggregateId).toBe(orderId)
    expect(event.occurredAt).toEqual(order.paymentApprovedAt)
    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'PLACED',
      status: 'PAYMENT_APPROVED',
      changedAt: order.paymentApprovedAt!.toISOString(),
    })

    expect(transaction.calls).toBe(1)
    expect(transaction.rolledBack).toBe(false)
    expect(orderRepository.writes).toEqual([
      { operation: 'update', id: orderId, tx: transaction.context },
    ])
    expect(domainEvents.calls).toHaveLength(1)
    expect(domainEvents.calls[0]!.tx).toBe(transaction.context)
  })

  test.each([
    ['PAYMENT_APPROVED', 'PICKING', 'order.picking-started'],
    ['PICKING', 'OUT_FOR_DELIVERY', 'order.out-for-delivery'],
    ['OUT_FOR_DELIVERY', 'DELIVERED', 'order.delivered'],
  ] as [OrderStatus, OrderStatus, string][])(
    'advances from %s to %s with %s',
    async (current, status, type) => {
      const { useCase, orderRepository, domainEvents } = await setup(current)

      const result = await useCase.execute(input({ status }))

      expect(result.instance).toEqual({ status, changed: true })
      expect(orderRepository.findStored(orderId)!.status).toBe(status)
      expect(domainEvents.events.map((event) => event.type)).toEqual([type])
    },
  )

  test.each([
    ['PAYMENT_APPROVED', 'PAYMENT_APPROVED'],
    ['OUT_FOR_DELIVERY', 'PICKING'],
    ['DELIVERED', 'PAYMENT_APPROVED'],
    ['DELIVERED', 'DELIVERED'],
  ] as [OrderStatus, OrderStatus][])(
    'an order in %s asked to reach %s ends with changed false, without a transaction or event',
    async (current, status) => {
      const { useCase, orderRepository, domainEvents, transaction } =
        await setup(current)
      const before = orderRepository.findStored(orderId)!.toDTO()

      const result = await useCase.execute(input({ status }))

      expect(result.isOk).toBe(true)
      expect(result.instance).toEqual({ status: current, changed: false })
      expect(transaction.calls).toBe(0)
      expect(orderRepository.writes).toEqual([])
      expect(domainEvents.calls).toHaveLength(0)
      expect(orderRepository.findStored(orderId)!.toDTO()).toEqual(before)
    },
  )

  test('fails with ORDER_STATUS_TRANSITION_INVALID for a skipped step, without a transaction', async () => {
    const { useCase, orderRepository, domainEvents, transaction } =
      await setup()

    const result = await useCase.execute(input({ status: 'PICKING' }))

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual([OrderErrors.ORDER_STATUS_TRANSITION_INVALID])
    expect(transaction.calls).toBe(0)
    expect(domainEvents.calls).toHaveLength(0)
    expect(orderRepository.findStored(orderId)!.status).toBe('PLACED')
  })

  test('fails with ORDER_NOT_FOUND for a missing order', async () => {
    const { useCase, domainEvents, transaction } = await setup(null)

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([OrderErrors.ORDER_NOT_FOUND])
    expect(transaction.calls).toBe(0)
    expect(domainEvents.calls).toHaveLength(0)
  })

  test.each(['PLACED', 'CANCELLED', 'payment_approved', undefined])(
    'fails with ORDER_STATUS_INVALID for the status %p, without reading the order',
    async (status) => {
      const { useCase, orderRepository, transaction } = await setup()
      const findById = jest.spyOn(orderRepository, 'findById')

      const result = await useCase.execute(
        input({ status: status as unknown as OrderStatus }),
      )

      expect(result.errors).toEqual([OrderErrors.ORDER_STATUS_INVALID])
      expect(findById).not.toHaveBeenCalled()
      expect(transaction.calls).toBe(0)
    },
  )

  test('fails with the code and rolls back when appending the event fails', async () => {
    const { useCase, orderRepository, domainEvents, transaction } =
      await setup()
    domainEvents.failWith('OUTBOX_APPEND_FAILED')

    const result = await useCase.execute(input())

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['OUTBOX_APPEND_FAILED'])
    expect(transaction.calls).toBe(1)
    expect(transaction.rolledBack).toBe(true)
    expect(domainEvents.events).toHaveLength(0)
    // The update was sent in the same transaction, which the database undoes.
    expect(orderRepository.writes).toEqual([
      { operation: 'update', id: orderId, tx: transaction.context },
    ])
  })

  test('fails with the code and rolls back when updating the order fails, before the event', async () => {
    const { useCase, orderRepository, domainEvents, transaction } =
      await setup()
    jest
      .spyOn(orderRepository, 'update')
      .mockResolvedValue(Result.fail(OrderErrors.ORDER_NOT_FOUND))

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([OrderErrors.ORDER_NOT_FOUND])
    expect(transaction.rolledBack).toBe(true)
    expect(domainEvents.calls).toHaveLength(0)
  })

  test('rethrows an error that is not a ResultError', async () => {
    const { useCase, orderRepository, transaction } = await setup()
    jest.spyOn(orderRepository, 'update').mockRejectedValue(new Error('boom'))

    await expect(useCase.execute(input())).rejects.toThrow('boom')
    expect(transaction.rolledBack).toBe(true)
  })

  test('propagates a failure of reading the order', async () => {
    const { useCase, orderRepository, transaction } = await setup()
    jest
      .spyOn(orderRepository, 'findById')
      .mockResolvedValue(Result.fail('DB_ERROR'))

    const result = await useCase.execute(input())

    expect(result.errors).toEqual(['DB_ERROR'])
    expect(transaction.calls).toBe(0)
  })

  test.each([undefined, '', 'abc'])(
    'fails with INVALID_ID for the orderId %p, without reading the order',
    async (value) => {
      const { useCase, orderRepository, transaction } = await setup()
      const findById = jest.spyOn(orderRepository, 'findById')

      const result = await useCase.execute(
        input({ orderId: value as unknown as string }),
      )

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(findById).not.toHaveBeenCalled()
      expect(transaction.calls).toBe(0)
    },
  )
})
