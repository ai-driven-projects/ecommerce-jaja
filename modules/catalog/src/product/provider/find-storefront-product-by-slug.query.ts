import { Result } from '@mentoria-360/shared'
import { StorefrontProductDetailDTO } from '../dto'

/**
 * Public product detail by exact slug.
 *
 * Visibility (the same rule in every storefront query): a product is visible
 * when it is not deleted, is active and its category and **all** ancestor
 * categories are active and not deleted. An inactive or deleted brand does not
 * hide the product: it comes with `brand: null`.
 *
 * - Resolves to `null` when no product has the slug, when it is deleted or not
 *   visible, or when the slug is empty (the API answers
 *   `404 PRODUCT_NOT_FOUND`).
 * - `categories` goes from the root category down to the product's own
 *   category.
 * - `images` holds every image, ordered by `order`.
 * - `discountPercent` is `round((1 - priceCents / listPriceCents) * 100)` with
 *   a list price, otherwise `null`.
 */
export interface FindStorefrontProductBySlugQuery {
  execute(slug: string): Promise<Result<StorefrontProductDetailDTO | null>>
}
