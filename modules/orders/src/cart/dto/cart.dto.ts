// One product of the cart with its quantity, as stored. No price is stored.
export interface CartItemDTO {
  productId: string
  quantity: number
}

// Returned by `Cart.toDTO()`. The domain only knows `userId` and `productId`:
// names, prices and availability come from the read side (`CartDetailDTO`).
// `items` follow the order in which each product entered the cart.
export interface CartDTO {
  id: string
  userId: string
  items: CartItemDTO[]
  createdAt: Date
  updatedAt: Date
}

// An item built outside the account cart (the guest cart in the browser), used
// by the preview and by the merge.
export interface CartItemInputDTO {
  productId: string
  quantity: number
}

// One line of the cart, computed by the read side with the current catalog
// data; nothing here is stored with the cart.
export interface CartLineDTO {
  productId: string
  slug: string
  name: string
  unit: string
  // Slug of the root category of the product.
  rootCategorySlug: string
  // Thumbnail of the main image, or `null` when the product has no images.
  thumbUrl: string | null
  // Current prices; `listPriceCents` is `null` when the product has none.
  priceCents: number
  listPriceCents: number | null
  quantity: number
  // Whether the product is visible on the storefront.
  isAvailable: boolean
  // `priceCents * quantity`, or `null` when the line is unavailable.
  lineTotalCents: number | null
}

// The cart as shown to the customer: lines and totals in cents, computed by the
// read side.
export interface CartDetailDTO {
  // In the order in which each product entered the cart.
  lines: CartLineDTO[]
  // Sum of the quantities of every line, unavailable ones included.
  itemCount: number
  // Sum of `lineTotalCents` of the available lines only.
  subtotalCents: number
  // 0 when the subtotal is 0 or at least `FREE_DELIVERY_THRESHOLD_CENTS`,
  // otherwise `DELIVERY_FEE_CENTS`.
  deliveryFeeCents: number
  // `subtotalCents + deliveryFeeCents`.
  totalCents: number
  // `FREE_DELIVERY_THRESHOLD_CENTS`.
  freeDeliveryThresholdCents: number
  // `freeDeliveryThresholdCents - subtotalCents` while the delivery is charged,
  // otherwise 0.
  missingForFreeDeliveryCents: number
  // Whether any line is unavailable.
  hasUnavailableItems: boolean
}
