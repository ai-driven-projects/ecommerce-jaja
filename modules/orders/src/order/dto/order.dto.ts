import { OrderStatus } from '../errors'

// One line of the order, frozen when the order is placed.
export interface OrderItemDTO {
  productId: string
  // Name and unit of the product at the moment of the order.
  name: string
  unit: string
  // Thumbnail of the main image, or `null` when the product had no images.
  thumbUrl: string | null
  unitPriceCents: number
  quantity: number
  // `unitPriceCents * quantity`.
  lineTotalCents: number
}

// Copy of the customer's address made when the order is placed. Same fields of
// the customer address, declared here so this module does not depend on
// `customers`.
export interface OrderDeliveryAddressDTO {
  // 8 digits.
  zipCode: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  // Two uppercase letters.
  state: string
}

// Returned by `Order.toDTO()`. Items follow the order of the cart and the totals
// are computed by the entity from the items.
export interface OrderDTO {
  id: string
  customerId: string
  status: OrderStatus
  items: OrderItemDTO[]
  deliveryAddress: OrderDeliveryAddressDTO
  recipientName: string
  // `null` when the customer sent no instructions.
  deliveryInstructions: string | null
  // Sum of the quantities of every item.
  itemCount: number
  // Sum of `lineTotalCents`.
  subtotalCents: number
  // 0 from `FREE_DELIVERY_THRESHOLD_CENTS`, otherwise `DELIVERY_FEE_CENTS`.
  deliveryFeeCents: number
  // `subtotalCents + deliveryFeeCents`.
  totalCents: number
  // Date of each step of the sequence: filled when the order reaches the step,
  // `null` while it has not (`placedAt` is always filled).
  placedAt: Date
  paymentApprovedAt: Date | null
  pickingStartedAt: Date | null
  outForDeliveryAt: Date | null
  deliveredAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// The order as shown to its customer, returned by `FindMyOrderByIdQuery`, with
// the totals read as stored.
export type OrderDetailDTO = Omit<OrderDTO, 'createdAt' | 'updatedAt'>

// The customer of an order as the operation sees it, read from `customers` and
// the linked user.
export interface OrderAdminCustomerDTO {
  // `customers.id`.
  id: string
  // Name of the linked user.
  name: string
  // Email of the linked user.
  email: string
  // Phone of the customer record, digits only (formatted by the front).
  phone: string
}

// The order of any customer, returned by `FindOrderByIdQuery` for the admin
// order monitor: the detail of the customer view plus who placed it and when
// the order was last stored.
export interface OrderAdminDetailDTO extends OrderDetailDTO {
  customer: OrderAdminCustomerDTO
  // Last write of the order (placement or a step).
  updatedAt: Date
}

// One row of the admin order listing (`FindOrdersQuery`) and of
// `OrdersSummaryDTO.latestInProgress`.
export interface OrderListItemDTO {
  id: string
  status: OrderStatus
  // Name of the user linked to the customer of the order.
  customerName: string
  // Neighborhood and city of the delivery address copied into the order.
  deliveryNeighborhood: string
  deliveryCity: string
  // Sum of the quantities of every item.
  itemCount: number
  // Total stored when the order was placed.
  totalCents: number
  placedAt: Date
  // Date of the most recent step reached: `deliveredAt`, `outForDeliveryAt`,
  // `pickingStartedAt`, `paymentApprovedAt` or, before any of them, `placedAt`.
  statusChangedAt: Date
}

// Status filter of the admin listing: one status, or `IN_PROGRESS` for every
// status other than `DELIVERED`.
export type OrderStatusFilter = OrderStatus | 'IN_PROGRESS'

// Paginated admin order listing: `page` starts at 1; `status` filters by status
// or `IN_PROGRESS` when defined; `search` is the trimmed text matched against
// the order number (start of the id without dashes) and the customer name.
export interface OrderFiltersDTO {
  page: number
  pageSize: number
  status?: OrderStatusFilter
  search?: string
}

// One page of orders; `totalPages` is `ceil(total / pageSize)`.
export interface OrderPageDTO {
  items: OrderListItemDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Indicators of the operation day, returned by `FindOrdersSummaryQuery`.
// "Today" is the current day in the operation time zone
// (`America/Sao_Paulo`); deleted orders are never counted.
export interface OrdersSummaryDTO {
  // Orders whose `placedAt` falls today.
  placedToday: number
  // Orders of any day whose status is not `DELIVERED`.
  inProgress: number
  // Orders whose `deliveredAt` falls today.
  deliveredToday: number
  // Sum of `totalCents` of the orders placed today (0 without orders).
  revenueTodayCents: number
  // Integer average of `totalCents` of the orders placed today, or `null`
  // without orders today.
  averageTicketTodayCents: number | null
  // Average of `deliveredAt - placedAt` of the orders delivered today, in
  // minutes with one decimal place, or `null` without deliveries today.
  averageDeliveryMinutesToday: number | null
  // Up to 6 in-progress orders, most recent `placedAt` first.
  latestInProgress: OrderListItemDTO[]
}

// The customer record of a user, as the order needs it: returned by
// `FindOrderCustomerByUserIdQuery`, inactive records included.
export interface OrderCustomerDTO {
  customerId: string
  isActive: boolean
  // Name of the linked user, the default recipient.
  name: string
  deliveryAddress: OrderDeliveryAddressDTO
}

// Input of `PlaceOrder`. Customer, items and prices never come from the
// request: they are read on the server from the user.
export interface PlaceOrderInputDTO {
  // The authenticated user.
  userId: string
  // Missing or blank uses the name of the user.
  recipientName?: string
  // Missing or blank resolves to `null`.
  deliveryInstructions?: string
}

// Output of `PlaceOrder`.
export interface PlaceOrderOutputDTO {
  orderId: string
}

// Input of `AdvanceOrderStatus`: the order and the status it must reach.
export interface AdvanceOrderStatusInputDTO {
  orderId: string
  // One of `ORDER_STATUSES` except `PLACED`.
  status: OrderStatus
}

// Output of `AdvanceOrderStatus`.
export interface AdvanceOrderStatusOutputDTO {
  // The current status of the order: the requested one when it advanced, or
  // the status it already had when it had reached the requested one.
  status: OrderStatus
  // `false` when the order had already reached the status and nothing was
  // stored.
  changed: boolean
}
