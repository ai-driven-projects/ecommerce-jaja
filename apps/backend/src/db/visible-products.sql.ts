import { Prisma } from '@prisma/client';

/**
 * Visibility rule of the storefront, shared by every storefront query
 * (`ProductPrisma` and `CategoryPrisma`): the `FROM` and `WHERE` of the visible
 * products, ready to receive more conditions with `AND`. The cart
 * (`CartPrisma`) uses the same rule for product availability.
 *
 * A product is visible when it is not deleted, is active and its category and
 * all its ancestors are active and not deleted. The domain caps the depth at 3,
 * so three joins cover the whole chain: `c1` (the product's category), `c2`
 * (parent) and `c3` (grandparent); they also give the category names to the
 * search and the detail. `b` is the brand only when it is active and not
 * deleted, so an inactive brand leaves the product without brand instead of
 * hiding it.
 *
 * `joins` adds joins that depend on `p` (e.g. the main image with
 * `LEFT JOIN LATERAL`) before the `WHERE`.
 */
export function visibleProducts(joins: Prisma.Sql = Prisma.empty): Prisma.Sql {
  return Prisma.sql`
    FROM products p
    JOIN categories c1 ON c1.id = p.category_id
    LEFT JOIN categories c2 ON c2.id = c1.parent_id
    LEFT JOIN categories c3 ON c3.id = c2.parent_id
    LEFT JOIN brands b ON b.id = p.brand_id AND b.is_active AND b.deleted_at IS NULL
    ${joins}
    WHERE p.deleted_at IS NULL AND p.is_active
      AND c1.is_active AND c1.deleted_at IS NULL
      AND (c1.parent_id IS NULL OR (c2.is_active AND c2.deleted_at IS NULL))
      AND (c2.parent_id IS NULL OR (c3.is_active AND c3.deleted_at IS NULL))`;
}
