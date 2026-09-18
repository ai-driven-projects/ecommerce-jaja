import { Result } from '@mentoria-360/shared'
import {
  ApproveOrderPayment,
  ApproveOrderPaymentInputDTO,
  OrderErrors,
  OrderPaymentApprovedEvent,
  OrderStatus,
} from '../../src/order'
import { customerId, orderId, setupStep } from './order-step.fixture'

// This file also covers the mechanics shared by the four operations of a step
// (transaction, idempotency, failures of the adapters); the other three cover
// the data and the transition of their own step.
async function setup(status: OrderStatus | null = 'PLACED') {
  return setupStep<ApproveOrderPaymentInputDTO>(
    (orders, events, transaction) =>
      new ApproveOrderPayment(orders, events, transaction),
    status,
  )
}

function input(
  overrides: Partial<ApproveOrderPaymentInputDTO> = {},
): ApproveOrderPaymentInputDTO {
  return {
    orderId,
    transactionId: 'TX-9B2E7C1A',
    paymentMethod: 'SIMULATED',
    ...overrides,
  }
}

describe('ApproveOrderPayment', () => {
  test('stores the approved order and its event with the same tx in one transaction', async () => {
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
    expect(event).toBeInstanceOf(OrderPaymentApprovedEvent)
    expect(event.type).toBe('order.payment-approved')
    expect(event.aggregateId).toBe(orderId)
    expect(event.occurredAt).toEqual(order.paymentApprovedAt)
    expect(event.payload).toEqual({
      customerId,
      previousStatus: 'PLACED',
      status: 'PAYMENT_APPROVED',
      changedAt: order.paymentApprovedAt!.toISOString(),
      transactionId: 'TX-9B2E7C1A',
      paymentMethod: 'SIMULATED',
      amountCents: order.totalCents,
    })

    expect(transaction.calls).toBe(1)
    expect(transaction.rolledBack).toBe(false)
    expect(orderRepository.writes).toEqual([
      { operation: 'update', id: orderId, tx: transaction.context },
    ])
    expect(domainEvents.calls).toHaveLength(1)
    expect(domainEvents.calls[0]!.tx).toBe(transaction.context)
  })

  test.each(['PAYMENT_APPROVED', 'PICKING', 'DELIVERED'] as OrderStatus[])(
    'an order in %s ends with changed false, without a transaction or event',
    async (status) => {
      const { useCase, orderRepository, domainEvents, transaction } =
        await setup(status)
      const before = orderRepository.findStored(orderId)!.toDTO()

      const result = await useCase.execute(input())

      expect(result.isOk).toBe(true)
      expect(result.instance).toEqual({ status, changed: false })
      expect(transaction.calls).toBe(0)
      expect(orderRepository.writes).toEqual([])
      expect(domainEvents.calls).toHaveLength(0)
      expect(orderRepository.findStored(orderId)!.toDTO()).toEqual(before)
    },
  )

  test('fails with ORDER_NOT_FOUND for a missing order', async () => {
    const { useCase, domainEvents, transaction } = await setup(null)

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([OrderErrors.ORDER_NOT_FOUND])
    expect(transaction.calls).toBe(0)
    expect(domainEvents.calls).toHaveLength(0)
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

  test.each([
    ['a blank transaction', { transactionId: '   ' }],
    ['a transaction longer than 64', { transactionId: 'x'.repeat(65) }],
    ['an unknown means of payment', { paymentMethod: 'BOLETO' }],
  ])(
    'fails with ORDER_PAYMENT_DATA_INVALID for %s, without a transaction',
    async (_, overrides) => {
      const { useCase, orderRepository, domainEvents, transaction } =
        await setup()

      const result = await useCase.execute(
        input(overrides as Partial<ApproveOrderPaymentInputDTO>),
      )

      expect(result.errors).toEqual([OrderErrors.ORDER_PAYMENT_DATA_INVALID])
      expect(transaction.calls).toBe(0)
      expect(domainEvents.calls).toHaveLength(0)
      expect(orderRepository.findStored(orderId)!.status).toBe('PLACED')
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
})
