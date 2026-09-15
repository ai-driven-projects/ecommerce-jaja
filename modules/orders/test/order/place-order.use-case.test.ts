import { Result } from '@mentoria-360/shared'
import { Cart, CartLineDTO } from '../../src/cart'
import {
  OrderCustomerDTO,
  OrderDeliveryAddressDTO,
  OrderErrors,
  PlaceOrder,
  PlaceOrderInputDTO,
} from '../../src/order'
import { FakeTransactionManager } from '../mock/fake-transaction.manager'
import { InMemoryCartRepository } from '../mock/in-memory-cart.repository'
import { InMemoryDomainEventRepository } from '../mock/in-memory-domain-event.repository'
import { InMemoryFindCartByUserIdQuery } from '../mock/in-memory-find-cart-by-user-id.query'
import { InMemoryFindOrderCustomerByUserIdQuery } from '../mock/in-memory-find-order-customer-by-user-id.query'
import { InMemoryOrderRepository } from '../mock/in-memory-order.repository'

const userId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'
const customerId = '9b2e7c1a-3f4d-4e5b-8a6c-7d8e9f0a1b2c'
const productA = '550e8400-e29b-41d4-a716-446655440000'
const productB = '11111111-2222-4333-8444-555555555555'
const thumbUrl = 'https://cdn.jaja.dev/products/banana-thumb.webp'

const address: OrderDeliveryAddressDTO = {
  zipCode: '60150160',
  street: 'Rua Silva Paulet',
  number: '1200',
  complement: null,
  neighborhood: 'Aldeota',
  city: 'Fortaleza',
  state: 'CE',
}

function customer(overrides: Partial<OrderCustomerDTO> = {}): OrderCustomerDTO {
  return {
    customerId,
    isActive: true,
    name: 'Ana Pereira Carvalho',
    deliveryAddress: address,
    ...overrides,
  }
}

function line(overrides: Partial<CartLineDTO> = {}): CartLineDTO {
  const base: CartLineDTO = {
    productId: productA,
    slug: 'banana-prata',
    name: 'Banana prata',
    unit: 'kg',
    rootCategorySlug: 'hortifruti',
    thumbUrl,
    priceCents: 799,
    listPriceCents: null,
    quantity: 2,
    isAvailable: true,
    lineTotalCents: null,
    ...overrides,
  }
  return {
    ...base,
    lineTotalCents: base.isAvailable ? base.priceCents * base.quantity : null,
  }
}

// Subtotal 2147: 799 x 2 + 549 x 1.
function twoLines(): CartLineDTO[] {
  return [
    line(),
    line({
      productId: productB,
      slug: 'leite-integral',
      name: 'Leite integral',
      unit: 'litro',
      rootCategorySlug: 'laticinios',
      thumbUrl: null,
      priceCents: 549,
      quantity: 1,
    }),
  ]
}

interface SetupOptions {
  customer?: OrderCustomerDTO | null
  lines?: CartLineDTO[]
  // Whether the account cart exists in the repository.
  storedCart?: boolean
}

async function setup(options: SetupOptions = {}) {
  const orderRepository = new InMemoryOrderRepository()
  const cartRepository = new InMemoryCartRepository()
  const findCustomer = new InMemoryFindOrderCustomerByUserIdQuery()
  const findCart = new InMemoryFindCartByUserIdQuery()
  const domainEvents = new InMemoryDomainEventRepository()
  const transaction = new FakeTransactionManager()

  const lines = options.lines ?? twoLines()
  findCustomer.set(
    userId,
    options.customer === undefined ? customer() : options.customer,
  )
  findCart.setLines(userId, lines)
  if (options.storedCart ?? true) {
    await cartRepository.create(
      Cart.create({
        userId,
        items: lines.map(({ productId, quantity }) => ({ productId, quantity })),
      }),
    )
  }

  const useCase = new PlaceOrder(
    orderRepository,
    cartRepository,
    findCustomer,
    findCart,
    domainEvents,
    transaction,
  )

  return {
    useCase,
    orderRepository,
    cartRepository,
    findCustomer,
    findCart,
    domainEvents,
    transaction,
  }
}

function input(overrides: Partial<PlaceOrderInputDTO> = {}): PlaceOrderInputDTO {
  return {
    userId,
    recipientName: 'Bruno Lima',
    deliveryInstructions: 'Deixar na portaria',
    ...overrides,
  }
}

async function storedCartItems(repository: InMemoryCartRepository) {
  return (await repository.findByUserId(userId)).instance?.items
}

describe('PlaceOrder', () => {
  test('stores the order with the cart prices, empties the cart and appends order.placed in one transaction', async () => {
    const {
      useCase,
      orderRepository,
      cartRepository,
      domainEvents,
      transaction,
    } = await setup()
    const updateCart = jest.spyOn(cartRepository, 'update')

    const result = await useCase.execute(input())

    expect(result.isOk).toBe(true)
    const { orderId } = result.instance
    expect(orderId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )

    expect(orderRepository.size).toBe(1)
    const order = orderRepository.findStored(orderId)!
    expect(order.toDTO()).toMatchObject({
      id: orderId,
      customerId,
      status: 'PLACED',
      items: [
        {
          productId: productA,
          name: 'Banana prata',
          unit: 'kg',
          thumbUrl,
          unitPriceCents: 799,
          quantity: 2,
          lineTotalCents: 1598,
        },
        {
          productId: productB,
          name: 'Leite integral',
          unit: 'litro',
          thumbUrl: null,
          unitPriceCents: 549,
          quantity: 1,
          lineTotalCents: 549,
        },
      ],
      deliveryAddress: address,
      recipientName: 'Bruno Lima',
      deliveryInstructions: 'Deixar na portaria',
      itemCount: 3,
      subtotalCents: 2147,
      deliveryFeeCents: 490,
      totalCents: 2637,
    })
    expect(order.hasEvents()).toBe(false)

    expect(await storedCartItems(cartRepository)).toEqual([])

    expect(domainEvents.events).toHaveLength(1)
    const event = domainEvents.events[0]!
    expect(event.type).toBe('order.placed')
    expect(event.aggregateId).toBe(orderId)
    expect(event.payload).toMatchObject({
      customerId,
      itemCount: 3,
      subtotalCents: 2147,
      deliveryFeeCents: 490,
      totalCents: 2637,
    })

    expect(transaction.calls).toBe(1)
    expect(transaction.rolledBack).toBe(false)
    expect(domainEvents.calls).toHaveLength(1)
    expect(orderRepository.writes).toEqual([
      { operation: 'create', id: orderId, tx: transaction.context },
    ])
    expect(updateCart).toHaveBeenCalledTimes(1)
    expect(updateCart.mock.calls[0]![1]).toBe(transaction.context)
    expect(domainEvents.calls[0]!.tx).toBe(transaction.context)
  })

  test.each([undefined, '', '   '])(
    'uses the name of the user for the recipientName %p',
    async (recipientName) => {
      const { useCase, orderRepository } = await setup()

      const result = await useCase.execute(input({ recipientName }))

      expect(result.isOk).toBe(true)
      expect(
        orderRepository.findStored(result.instance.orderId)!.recipientName,
      ).toBe('Ana Pereira Carvalho')
    },
  )

  test('trims the informed recipientName and resolves blank instructions to null', async () => {
    const { useCase, orderRepository } = await setup()

    const result = await useCase.execute(
      input({ recipientName: '  Bruno Lima ', deliveryInstructions: '  ' }),
    )

    const order = orderRepository.findStored(result.instance.orderId)!
    expect(order.recipientName).toBe('Bruno Lima')
    expect(order.deliveryInstructions).toBeNull()
  })

  test.each([
    ['without a customer record', { customer: null }, OrderErrors.ORDER_CUSTOMER_REQUIRED],
    ['with an inactive customer', { customer: customer({ isActive: false }) }, OrderErrors.ORDER_CUSTOMER_INACTIVE],
    ['with an empty cart', { lines: [] }, OrderErrors.ORDER_CART_EMPTY],
    [
      'with an unavailable item',
      { lines: [line(), line({ productId: productB, isAvailable: false })] },
      OrderErrors.ORDER_CART_HAS_UNAVAILABLE_ITEMS,
    ],
  ] as [string, SetupOptions, string][])(
    'fails %s without opening a transaction',
    async (_, options, code) => {
      const { useCase, orderRepository, cartRepository, domainEvents, transaction } =
        await setup(options)
      const itemsBefore = await storedCartItems(cartRepository)

      const result = await useCase.execute(input())

      expect(result.errors).toEqual([code])
      expect(transaction.calls).toBe(0)
      expect(domainEvents.calls).toHaveLength(0)
      expect(orderRepository.size).toBe(0)
      expect(await storedCartItems(cartRepository)).toEqual(itemsBefore)
    },
  )

  test('stops at the first rule that fails', async () => {
    const { useCase, findCart } = await setup({
      customer: customer({ isActive: false }),
      lines: [],
    })

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([OrderErrors.ORDER_CUSTOMER_INACTIVE])
    expect(findCart.calls).toHaveLength(0)
  })

  test('fails with the validation of the order without opening a transaction', async () => {
    const { useCase, orderRepository, domainEvents, transaction } = await setup()

    const result = await useCase.execute(input({ recipientName: 'A' }))

    expect(result.errors).toEqual(['TEXT_TOO_SHORT'])
    expect(transaction.calls).toBe(0)
    expect(domainEvents.calls).toHaveLength(0)
    expect(orderRepository.size).toBe(0)
  })

  test('fails with ORDER_CART_EMPTY when the account cart is missing from the repository', async () => {
    const { useCase, transaction } = await setup({ storedCart: false })

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([OrderErrors.ORDER_CART_EMPTY])
    expect(transaction.calls).toBe(0)
  })

  test('fails with the code and rolls back when appending the event fails', async () => {
    const { useCase, domainEvents, transaction } = await setup()
    domainEvents.failWith('OUTBOX_APPEND_FAILED')

    const result = await useCase.execute(input())

    expect(result.isFailure).toBe(true)
    expect(result.errors).toEqual(['OUTBOX_APPEND_FAILED'])
    expect(transaction.calls).toBe(1)
    expect(transaction.rolledBack).toBe(true)
    expect(domainEvents.events).toHaveLength(0)
  })

  test('fails with the code and rolls back when storing the order fails, before the cart and the event', async () => {
    const { useCase, orderRepository, cartRepository, domainEvents, transaction } =
      await setup()
    jest
      .spyOn(orderRepository, 'create')
      .mockResolvedValue(Result.fail(OrderErrors.ORDER_PRODUCT_NOT_FOUND))
    const updateCart = jest.spyOn(cartRepository, 'update')

    const result = await useCase.execute(input())

    expect(result.errors).toEqual([OrderErrors.ORDER_PRODUCT_NOT_FOUND])
    expect(transaction.rolledBack).toBe(true)
    expect(updateCart).not.toHaveBeenCalled()
    expect(domainEvents.calls).toHaveLength(0)
  })

  test('rethrows an error that is not a ResultError', async () => {
    const { useCase, orderRepository, transaction } = await setup()
    jest.spyOn(orderRepository, 'create').mockRejectedValue(new Error('boom'))

    await expect(useCase.execute(input())).rejects.toThrow('boom')
    expect(transaction.rolledBack).toBe(true)
  })

  test.each([undefined, '', 'abc'])(
    'fails with INVALID_ID for the userId %p',
    async (value) => {
      const { useCase, findCustomer, transaction } = await setup()

      const result = await useCase.execute(
        input({ userId: value as unknown as string }),
      )

      expect(result.errors).toEqual(['INVALID_ID'])
      expect(findCustomer.calls).toHaveLength(0)
      expect(transaction.calls).toBe(0)
    },
  )

  test('propagates a failure of the customer query', async () => {
    const { useCase, findCustomer, transaction } = await setup()
    jest
      .spyOn(findCustomer, 'execute')
      .mockResolvedValue(Result.fail('DB_ERROR'))

    const result = await useCase.execute(input())

    expect(result.errors).toEqual(['DB_ERROR'])
    expect(transaction.calls).toBe(0)
  })
})
