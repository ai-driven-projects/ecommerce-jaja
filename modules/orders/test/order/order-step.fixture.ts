import {
  DomainEventRepository,
  TransactionManager,
  UseCase,
} from '@mentoria-360/shared'
import {
  Order,
  OrderProps,
  OrderRepository,
  OrderStatus,
  OrderStepOutputDTO,
} from '../../src/order'
import { FakeTransactionManager } from '../mock/fake-transaction.manager'
import { InMemoryDomainEventRepository } from '../mock/in-memory-domain-event.repository'
import { InMemoryOrderRepository } from '../mock/in-memory-order.repository'

// What the four tests of the operations of a step share: the stored order, its
// dates and the assembly of the use case with the in-memory adapters.

export const orderId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
export const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
export const recipientName = 'Ana Pereira'
export const placedAt = new Date('2026-09-14T15:30:00.000Z')
export const paymentApprovedAt = new Date('2026-09-14T15:30:03.000Z')
export const pickingStartedAt = new Date('2026-09-14T15:30:05.000Z')
export const outForDeliveryAt = new Date('2026-09-14T15:30:11.000Z')
export const deliveredAt = new Date('2026-09-14T15:30:19.000Z')

// The step dates of a stored order in `status`.
export const STEP_DATES: Record<OrderStatus, Partial<OrderProps>> = {
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

export function storedOrder(status: OrderStatus = 'PLACED'): Order {
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
    recipientName,
    deliveryInstructions: null,
    placedAt,
    createdAt: placedAt,
    updatedAt: placedAt,
    ...STEP_DATES[status],
  })
}

// Builds the use case of a step with the in-memory adapters. `status` is the
// stored status of the order; `null` stores no order.
export async function setupStep<IN>(
  build: (
    orderRepository: OrderRepository,
    domainEvents: DomainEventRepository,
    transaction: TransactionManager,
  ) => UseCase<IN, OrderStepOutputDTO>,
  status: OrderStatus | null = 'PLACED',
) {
  const orderRepository = new InMemoryOrderRepository()
  const domainEvents = new InMemoryDomainEventRepository()
  const transaction = new FakeTransactionManager()

  if (status) await orderRepository.create(storedOrder(status))
  // Only the writes of the use case matter to the tests.
  orderRepository.writes.length = 0

  const useCase = build(orderRepository, domainEvents, transaction)

  return { useCase, orderRepository, domainEvents, transaction }
}
