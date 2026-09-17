import {
  AggregateRoot,
  EntityProps,
  Id,
  Result,
  Text,
} from '@mentoria-360/shared'
import {
  CART_MAX_ITEMS,
  DELIVERY_FEE_CENTS,
  FREE_DELIVERY_THRESHOLD_CENTS,
} from '../../cart'
import { OrderDTO } from '../dto'
import {
  ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH,
  ORDER_RECIPIENT_NAME_MAX_LENGTH,
  ORDER_STATUSES,
  OrderErrors,
  OrderStatus,
  orderStatusIndex,
} from '../errors'
import { OrderEvent, OrderPlacedEvent, OrderStatusChangedEvent } from '../event'
import {
  OrderDeliveryAddress,
  OrderDeliveryAddressProps,
} from './order-delivery-address.vo'
import { OrderItem, OrderItemProps } from './order-item.vo'

export interface OrderProps extends EntityProps {
  customerId: string
  status: OrderStatus
  items: OrderItemProps[]
  deliveryAddress: OrderDeliveryAddressProps
  recipientName: string
  deliveryInstructions?: string | null
  placedAt: Date
  // Dates of the next steps; missing resolves to `null`.
  paymentApprovedAt?: Date | null
  pickingStartedAt?: Date | null
  outForDeliveryAt?: Date | null
  deliveredAt?: Date | null
}

// The prop that holds the date of each step of the sequence.
type OrderStepDateProp =
  | 'placedAt'
  | 'paymentApprovedAt'
  | 'pickingStartedAt'
  | 'outForDeliveryAt'
  | 'deliveredAt'

const ORDER_STEP_DATE_PROPS: Record<OrderStatus, OrderStepDateProp> = {
  PLACED: 'placedAt',
  PAYMENT_APPROVED: 'paymentApprovedAt',
  PICKING: 'pickingStartedAt',
  OUT_FOR_DELIVERY: 'outForDeliveryAt',
  DELIVERED: 'deliveredAt',
}

// The optional step dates, in the order of the sequence (`placedAt` is always
// required and checked on its own).
const ORDER_NEXT_STEP_STATUSES = ORDER_STATUSES.slice(1)

// What the customer's confirmation provides to `Order.place`; id, status and
// `placedAt` are generated.
export interface PlaceOrderProps {
  customerId: string
  items: OrderItemProps[]
  deliveryAddress: OrderDeliveryAddressProps
  recipientName: string
  deliveryInstructions?: string | null
}

// Minimum length of the recipient name, after trimming.
const ORDER_RECIPIENT_NAME_MIN_LENGTH = 2

// An order belongs to a customer (`customerId`, never the user), which never
// changes. Items, prices, address and recipient are copies made when the order
// is placed and never follow later changes of the catalog or of the customer
// record. The totals are always computed from the items; the database stores
// them only for reading.
//
// The status follows the sequence of `ORDER_STATUSES`: `PLACED` →
// `PAYMENT_APPROVED` → `PICKING` → `OUT_FOR_DELIVERY` → `DELIVERED`, and only
// advances one step at a time (`advanceTo`). Each step has its date
// (`placedAt`, `paymentApprovedAt`, `pickingStartedAt`, `outForDeliveryAt`,
// `deliveredAt`), filled if and only if the order has reached the step.
//
// `place` creates a new order and adds `OrderPlacedEvent`; `advanceTo` returns
// a clone in the next status with `OrderStatusChangedEvent`; `tryCreate` and
// `create` rehydrate a stored order and never add events. `cloneWith` carries
// the pending events to the clone, so behavior methods add their events to the
// returned instance and the original one never changes.
export class Order extends AggregateRoot<Order, OrderProps, OrderEvent> {
  private constructor(props: OrderProps) {
    super(props)
  }

  static create(props: OrderProps): Order {
    const result = Order.tryCreate(props)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(props: OrderProps): Result<Order> {
    const input: Partial<OrderProps> = props ?? {}

    const id = Id.tryCreate(input.id)
    // `Id.tryCreate` would generate a uuid for a missing value.
    const customerId = Id.required(
      typeof input.customerId === 'string' ? input.customerId : '',
    )
    const status = Order.isValidStatus(input.status)
      ? Result.ok()
      : Result.fail(OrderErrors.ORDER_STATUS_INVALID)

    const items = (Array.isArray(input.items) ? input.items : []).map((item) =>
      OrderItem.tryCreate(item),
    )
    const itemsCount =
      items.length === 0
        ? Result.fail(OrderErrors.ORDER_ITEMS_REQUIRED)
        : items.length > CART_MAX_ITEMS
          ? Result.fail(OrderErrors.ORDER_ITEMS_LIMIT_EXCEEDED)
          : Result.ok()

    // Only the valid items are compared; the others fail with their own errors.
    const productIds = items
      .filter((item) => item.isOk)
      .map((item) => item.instance.productId)
    const uniqueProducts =
      new Set(productIds).size < productIds.length
        ? Result.fail(OrderErrors.ORDER_ITEM_DUPLICATED)
        : Result.ok()

    const deliveryAddress = OrderDeliveryAddress.tryCreate(
      input.deliveryAddress as OrderDeliveryAddressProps,
    )
    const recipientName = Text.tryCreate(input.recipientName as string, {
      minLength: ORDER_RECIPIENT_NAME_MIN_LENGTH,
      maxLength: ORDER_RECIPIENT_NAME_MAX_LENGTH,
    })
    // Missing or blank instructions resolve to `null`.
    const deliveryInstructions = Text.tryCreate(input.deliveryInstructions, {
      optional: true,
      maxLength: ORDER_DELIVERY_INSTRUCTIONS_MAX_LENGTH,
    })
    // `placedAt` is the moment the order entered `PLACED`; there is no code of
    // its own, since `place` always generates it and a stored order always has
    // it, so a missing or invalid date is reported as an invalid status.
    const placedAt = isValidDate(input.placedAt)
      ? Result.ok()
      : Result.fail(OrderErrors.ORDER_STATUS_INVALID)
    // Each next step date must be valid when present, and present if and only
    // if the status has reached the step; any inconsistency is an invalid
    // status. Only checked for a known status, which fails on its own otherwise.
    const stepDates = Order.isValidStatus(input.status)
      ? Order.checkStepDates(input.status, input)
      : Result.ok()

    const attrs = Result.combine([
      id,
      customerId,
      status,
      itemsCount,
      uniqueProducts,
      ...items,
      deliveryAddress,
      recipientName,
      deliveryInstructions,
      placedAt,
      stepDates,
    ])
    if (attrs.isFailure) return Result.fail([...new Set(attrs.errors)])

    return Result.ok(
      new Order({
        ...input,
        id: id.instance.value,
        customerId: customerId.instance.value,
        status: input.status as OrderStatus,
        items: items.map((item) => item.instance.toProps()),
        deliveryAddress: deliveryAddress.instance.toDTO(),
        recipientName: recipientName.instance.value,
        deliveryInstructions: deliveryInstructions.instance?.value ?? null,
        placedAt: new Date((input.placedAt as Date).getTime()),
        paymentApprovedAt: copyDate(input.paymentApprovedAt),
        pickingStartedAt: copyDate(input.pickingStartedAt),
        outForDeliveryAt: copyDate(input.outForDeliveryAt),
        deliveredAt: copyDate(input.deliveredAt),
      }),
    )
  }

  private static checkStepDates(
    status: OrderStatus,
    input: Partial<OrderProps>,
  ): Result<void> {
    const reached = orderStatusIndex(status)
    const consistent = ORDER_NEXT_STEP_STATUSES.every((step) => {
      const value = input[ORDER_STEP_DATE_PROPS[step]]
      const present = value !== undefined && value !== null
      if (present && !isValidDate(value)) return false
      return present === reached >= orderStatusIndex(step)
    })

    return consistent
      ? Result.ok()
      : Result.fail(OrderErrors.ORDER_STATUS_INVALID)
  }

  // A new order from the customer's confirmation: generates the id, `PLACED`
  // and `placedAt`, validates everything through `tryCreate` and, only when it
  // succeeds, adds exactly one `OrderPlacedEvent` to the created order.
  static place(props: PlaceOrderProps): Result<Order> {
    const input: Partial<PlaceOrderProps> = props ?? {}
    const now = new Date()

    const created = Order.tryCreate({
      id: Id.createUUID(),
      customerId: input.customerId as string,
      status: 'PLACED',
      items: input.items as OrderItemProps[],
      deliveryAddress: input.deliveryAddress as OrderDeliveryAddressProps,
      recipientName: input.recipientName as string,
      deliveryInstructions: input.deliveryInstructions,
      placedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    if (created.isFailure) return created.withFail

    const order = created.instance
    const event = OrderPlacedEvent.tryCreate({
      orderId: order.id,
      customerId: order.customerId,
      items: order.items.map((item) => item.toDTO()),
      itemCount: order.itemCount,
      subtotalCents: order.subtotalCents,
      deliveryFeeCents: order.deliveryFeeCents,
      totalCents: order.totalCents,
      placedAt: order.placedAt,
    })
    if (event.isFailure) return event.withFail

    order.addEvent(event.instance)
    return Result.ok(order)
  }

  // One of `ORDER_STATUSES`.
  static isValidStatus(value: unknown): value is OrderStatus {
    return (ORDER_STATUSES as readonly unknown[]).includes(value)
  }

  // Advances the order to `status`, which must be the **next** one of the
  // sequence: the current status, a previous one, a skipped step, an unknown
  // status or any status after `DELIVERED` fail with
  // `ORDER_STATUS_TRANSITION_INVALID`. Returns a clone with the status, the date
  // of the step and `updatedAt` set to `now`, and adds `OrderStatusChangedEvent`
  // to it; this instance never changes and never receives events.
  advanceTo(status: OrderStatus, now: Date = new Date()): Result<Order> {
    const next = ORDER_STATUSES[orderStatusIndex(this.status) + 1]
    if (next === undefined || status !== next) {
      return Result.fail(OrderErrors.ORDER_STATUS_TRANSITION_INVALID)
    }

    const advanced = this.cloneWith({
      status: next,
      [ORDER_STEP_DATE_PROPS[next]]: now,
      updatedAt: now,
    })
    if (advanced.isFailure) return advanced.withFail

    const event = OrderStatusChangedEvent.tryCreate({
      orderId: this.id,
      customerId: this.customerId,
      previousStatus: this.status,
      status: next,
      changedAt: advanced.instance.dateOf(next) as Date,
    })
    if (event.isFailure) return event.withFail

    advanced.instance.addEvent(event.instance)
    return advanced
  }

  // Whether the order is in `status` or has already passed it. `false` for an
  // unknown status.
  hasReached(status: OrderStatus): boolean {
    return (
      Order.isValidStatus(status) &&
      orderStatusIndex(this.status) >= orderStatusIndex(status)
    )
  }

  // A copy of the date of the step, or `null` while the order has not reached
  // it.
  private dateOf(status: OrderStatus): Date | null {
    return copyDate(this.props[ORDER_STEP_DATE_PROPS[status]])
  }

  get customerId(): string {
    return this.props.customerId
  }

  get status(): OrderStatus {
    return this.props.status
  }

  // Frozen items, in the order of the cart.
  get items(): OrderItem[] {
    return this.props.items.map((item) => OrderItem.create(item))
  }

  get deliveryAddress(): OrderDeliveryAddress {
    return OrderDeliveryAddress.create(this.props.deliveryAddress)
  }

  get recipientName(): string {
    return this.props.recipientName
  }

  get deliveryInstructions(): string | null {
    return this.props.deliveryInstructions ?? null
  }

  // A copy, so callers cannot change the entity.
  get placedAt(): Date {
    return new Date(this.props.placedAt.getTime())
  }

  // Copies, or `null` while the order has not reached the step.
  get paymentApprovedAt(): Date | null {
    return this.dateOf('PAYMENT_APPROVED')
  }

  get pickingStartedAt(): Date | null {
    return this.dateOf('PICKING')
  }

  get outForDeliveryAt(): Date | null {
    return this.dateOf('OUT_FOR_DELIVERY')
  }

  get deliveredAt(): Date | null {
    return this.dateOf('DELIVERED')
  }

  // Sum of the quantities of every item.
  get itemCount(): number {
    return this.props.items.reduce((total, item) => total + item.quantity, 0)
  }

  // Sum of `lineTotalCents`; always greater than 0, since there is at least one
  // item with a price of at least 1 cent.
  get subtotalCents(): number {
    return this.items.reduce((total, item) => total + item.lineTotalCents, 0)
  }

  // 0 from `FREE_DELIVERY_THRESHOLD_CENTS`, otherwise `DELIVERY_FEE_CENTS`: the
  // same rule of the cart.
  get deliveryFeeCents(): number {
    return this.subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS
      ? 0
      : DELIVERY_FEE_CENTS
  }

  // `subtotalCents + deliveryFeeCents`.
  get totalCents(): number {
    return this.subtotalCents + this.deliveryFeeCents
  }

  toDTO(): OrderDTO {
    return {
      id: this.id,
      customerId: this.customerId,
      status: this.status,
      items: this.items.map((item) => item.toDTO()),
      deliveryAddress: this.deliveryAddress.toDTO(),
      recipientName: this.recipientName,
      deliveryInstructions: this.deliveryInstructions,
      itemCount: this.itemCount,
      subtotalCents: this.subtotalCents,
      deliveryFeeCents: this.deliveryFeeCents,
      totalCents: this.totalCents,
      placedAt: this.placedAt,
      paymentApprovedAt: this.paymentApprovedAt,
      pickingStartedAt: this.pickingStartedAt,
      outForDeliveryAt: this.outForDeliveryAt,
      deliveredAt: this.deliveredAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}

// Checked by tag instead of `instanceof`: `cloneWith` uses `structuredClone`,
// which can return a `Date` of another realm (e.g. the jest vm).
function isValidDate(value: unknown): value is Date {
  return (
    Object.prototype.toString.call(value) === '[object Date]' &&
    !Number.isNaN((value as Date).getTime())
  )
}

// A copy of a date, or `null` for a missing one.
function copyDate(value: Date | null | undefined): Date | null {
  return value === undefined || value === null
    ? null
    : new Date(value.getTime())
}
