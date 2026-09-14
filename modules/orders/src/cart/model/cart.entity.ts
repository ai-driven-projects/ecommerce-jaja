import { Entity, EntityProps, Id, Result } from '@mentoria-360/shared'
import { CartDTO, CartItemInputDTO } from '../dto'
import { CART_ITEM_MAX_QUANTITY, CART_MAX_ITEMS, CartErrors } from '../errors'
import { CartItem, CartItemProps } from './cart-item.vo'

export interface CartProps extends EntityProps {
  userId: string
  items?: CartItemProps[] | null
}

// A cart belongs to exactly one user (`userId`), which never changes after
// creation. The domain only knows `userId` and `productId`: names, prices and
// availability come from the read side, and no price is stored. Items keep the
// order in which each product entered the cart and the list is always replaced
// as a whole. Rules that depend on the repository (one cart per user) or on the
// catalog (available products) live in the use cases.
//
// Every behavior method is pure: it returns a new cart (`cloneWith`, with a new
// `updatedAt`) and never changes the current one.
export class Cart extends Entity<Cart, CartProps> {
  private constructor(props: CartProps) {
    super(props)
  }

  static create(props: CartProps): Cart {
    const result = Cart.tryCreate(props)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(props: CartProps): Result<Cart> {
    const id = Id.tryCreate(props.id)
    // `Id.tryCreate` would generate a uuid for a missing value.
    const userId = Id.required(
      typeof props.userId === 'string' ? props.userId : '',
    )

    const items = (props.items ?? []).map((item) => CartItem.tryCreate(item))
    const itemsLimit =
      items.length > CART_MAX_ITEMS
        ? Result.fail(CartErrors.CART_ITEMS_LIMIT_EXCEEDED)
        : Result.ok()

    // Only the valid items are compared; the others fail with their own errors.
    const productIds = items
      .filter((item) => item.isOk)
      .map((item) => item.instance.productId)
    const uniqueProducts =
      new Set(productIds).size < productIds.length
        ? Result.fail(CartErrors.CART_ITEM_DUPLICATED)
        : Result.ok()

    const attrs = Result.combine([
      id,
      userId,
      itemsLimit,
      uniqueProducts,
      ...items,
    ])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new Cart({
        ...props,
        id: id.instance.value,
        userId: userId.instance.value,
        items: items.map((item) => item.instance.toProps()),
      }),
    )
  }

  // Entries a merge can use, in the order received: entries with a malformed
  // `productId` or a quantity that is not an integer >= 1 are discarded, the
  // quantities of a repeated `productId` are summed into its first occurrence
  // and every quantity is limited to `CART_ITEM_MAX_QUANTITY`. Never fails.
  static mergeableItems(items: CartItemInputDTO[]): CartItemInputDTO[] {
    const result: CartItemInputDTO[] = []

    for (const entry of Array.isArray(items) ? items : []) {
      const input: Partial<CartItemInputDTO> = entry ?? {}
      const productId = Id.required(
        typeof input.productId === 'string' ? input.productId : '',
      )
      const quantity = input.quantity
      if (productId.isFailure) continue
      if (typeof quantity !== 'number' || !Number.isInteger(quantity)) continue
      if (quantity < 1) continue

      const current = result.find(
        (item) => item.productId === productId.instance.value,
      )
      if (current) {
        current.quantity = limitQuantity(current.quantity + quantity)
      } else {
        result.push({
          productId: productId.instance.value,
          quantity: limitQuantity(quantity),
        })
      }
    }

    return result
  }

  get userId(): string {
    return this.props.userId
  }

  // Copies in the order of inclusion, so callers cannot change the entity.
  get items(): CartItemProps[] {
    return (this.props.items ?? []).map((item) => ({ ...item }))
  }

  // Sum of the quantities of every item.
  get itemCount(): number {
    return (this.props.items ?? []).reduce(
      (total, item) => total + item.quantity,
      0,
    )
  }

  // Quantity of the product in the cart, or 0 when it is not in the cart.
  quantityOf(productId: string): number {
    const items = this.props.items ?? []
    return items[indexOf(items, productId)]?.quantity ?? 0
  }

  // A product already in the cart has the quantity summed, keeping its
  // position, and a sum above `CART_ITEM_MAX_QUANTITY` fails with
  // `CART_ITEM_QUANTITY_EXCEEDED`; a new product enters at the end. An invalid
  // quantity fails with `CART_ITEM_QUANTITY_INVALID`, and a new product beyond
  // `CART_MAX_ITEMS` with `CART_ITEMS_LIMIT_EXCEEDED`.
  addItem(productId: string, quantity: number): Result<Cart> {
    const item = CartItem.tryCreate({ productId, quantity })
    if (item.isFailure) return item.withFail

    const items = this.items
    const index = indexOf(items, item.instance.productId)
    if (index < 0) return this.withItems([...items, item.instance.toProps()])

    const current = items[index]!
    const sum = current.quantity + item.instance.quantity
    if (sum > CART_ITEM_MAX_QUANTITY) {
      return Result.fail(CartErrors.CART_ITEM_QUANTITY_EXCEEDED)
    }

    items[index] = { ...current, quantity: sum }
    return this.withItems(items)
  }

  // Replaces the quantity of a product already in the cart, keeping its
  // position, or includes the product at the end. Same validations as `addItem`.
  setItemQuantity(productId: string, quantity: number): Result<Cart> {
    const item = CartItem.tryCreate({ productId, quantity })
    if (item.isFailure) return item.withFail

    const items = this.items
    const index = indexOf(items, item.instance.productId)
    if (index < 0) return this.withItems([...items, item.instance.toProps()])

    items[index] = item.instance.toProps()
    return this.withItems(items)
  }

  // Removes the product. A product that is not in the cart returns this same
  // cart, without changing `updatedAt`.
  removeItem(productId: string): Result<Cart> {
    const items = this.items
    const index = indexOf(items, productId)
    if (index < 0) return Result.ok(this)

    return this.withItems(items.filter((_, position) => position !== index))
  }

  // Removes every item.
  clear(): Result<Cart> {
    return this.withItems([])
  }

  // Merges the guest cart, going through `mergeableItems` in order: a product
  // already in the cart has the quantity summed, limited to
  // `CART_ITEM_MAX_QUANTITY`, keeping its position; a new product enters at the
  // end while the cart has fewer than `CART_MAX_ITEMS` products, and the others
  // are ignored. Never fails because of the items.
  merge(items: CartItemInputDTO[]): Result<Cart> {
    const next = this.items

    for (const entry of Cart.mergeableItems(items)) {
      const index = indexOf(next, entry.productId)
      if (index >= 0) {
        const current = next[index]!
        next[index] = {
          ...current,
          quantity: limitQuantity(current.quantity + entry.quantity),
        }
      } else if (next.length < CART_MAX_ITEMS) {
        next.push({ ...entry })
      }
    }

    return this.withItems(next)
  }

  toDTO(): CartDTO {
    return {
      id: this.id,
      userId: this.userId,
      items: this.items,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }

  // `cloneWith` replaces the whole list and revalidates the cart.
  private withItems(items: CartItemProps[]): Result<Cart> {
    return this.cloneWith({ items, updatedAt: new Date() })
  }
}

// Position of the product in the list, or -1. Ids are compared as stored
// (trimmed and lowercase).
function indexOf(items: CartItemProps[], productId: string): number {
  const key = typeof productId === 'string' ? productId.trim().toLowerCase() : ''
  return items.findIndex((item) => item.productId === key)
}

function limitQuantity(quantity: number): number {
  return Math.min(quantity, CART_ITEM_MAX_QUANTITY)
}
