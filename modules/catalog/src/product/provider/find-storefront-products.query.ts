import { Result } from '@mentoria-360/shared'
import { StorefrontProductFiltersDTO, StorefrontProductPageDTO } from '../dto'

/**
 * One page of the public storefront product list.
 *
 * Visibility (the same rule in every storefront query): a product is visible
 * when it is not deleted, is active and its category and **all** ancestor
 * categories are active and not deleted. An inactive or deleted brand does not
 * hide the product: it comes with `brandName: null` and stays out of
 * `brandFacets`. Non-visible products never appear in `items`, `total` or
 * `brandFacets`.
 *
 * - `search` matches name, sku, brand name, the names of the product's
 *   category and of its ancestors, and description. The text is split into
 *   terms (letters and digits only, at most 10), accents and case are ignored
 *   and every term must match the start of a word in any of those fields;
 *   different terms may match different fields ("caneta bic" matches name +
 *   brand). Relevance weights: name, sku and brand > categories > description.
 *   A text without valid terms is treated as no search.
 * - `categorySlug` keeps the products of that category and of all its
 *   descendants. An unknown or non-visible slug resolves to an empty page,
 *   not to a failure.
 * - `brandSlugs` keeps the products of any of those brands (OR); unknown slugs
 *   are ignored.
 * - `minPriceCents`/`maxPriceCents` form a closed range over `priceCents`;
 *   when `min > max` the two are swapped.
 * - `onSale` keeps only products with `listPriceCents`; `featured` keeps only
 *   products with `isFeatured`.
 * - Filters and `search` are combined (all must match). `total` and
 *   `totalPages` (`ceil(total / pageSize)`) are computed over the filtered
 *   result, and a page past the last one returns `items: []`.
 * - `sort`:
 *   - `relevance`: best `search` matches first (default with `search`);
 *     without `search` it orders like `featured`;
 *   - `featured`: featured products first (default without `search`);
 *   - `price-asc` / `price-desc`: by `priceCents`;
 *   - `name`: by name;
 *   - `discount`: highest `discountPercent` first, products without discount
 *     last.
 *
 *   Every order ends with the name ignoring case and accents and then `id`,
 *   so consecutive pages never repeat or skip products.
 * - `brandFacets`: active, non-deleted brands present in the result computed
 *   with `search` and every filter **except** `brandSlugs`, each with its
 *   product count, ordered by count descending and then name, at most 30.
 * - Each item has `discountPercent` (`round((1 - priceCents / listPriceCents)
 *   * 100)` with a list price, otherwise `null`) and `thumbUrl` (thumbnail of
 *   the main image, or `null` without images).
 */
export interface FindStorefrontProductsQuery {
  execute(
    filter: StorefrontProductFiltersDTO,
  ): Promise<Result<StorefrontProductPageDTO>>
}
