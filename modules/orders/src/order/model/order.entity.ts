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
} from '../errors'
import { OrderPlacedEvent } from '../event'
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
}

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
// `place` creates a new order and adds `OrderPlacedEvent`; `tryCreate` and
// `create` rehydrate a stored order and never add events. `cloneWith` carries
// the pending events to the clone, so future behavior methods add their events
// to the returned instance.
export class Order extends AggregateRoot<Order, OrderProps, OrderPlacedEvent> {
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
      }),
    )
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
