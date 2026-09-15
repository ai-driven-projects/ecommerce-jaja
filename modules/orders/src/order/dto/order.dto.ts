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
  placedAt: Date
  createdAt: Date
  updatedAt: Date
}

// The order as shown to its customer, returned by `FindMyOrderByIdQuery`, with
// the totals read as stored.
export type OrderDetailDTO = Omit<OrderDTO, 'createdAt' | 'updatedAt'>

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
