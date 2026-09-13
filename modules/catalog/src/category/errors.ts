export const CategoryErrors = {
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  PARENT_CATEGORY_NOT_FOUND: 'PARENT_CATEGORY_NOT_FOUND',
  CATEGORY_SLUG_ALREADY_EXISTS: 'CATEGORY_SLUG_ALREADY_EXISTS',
  CATEGORY_MAX_DEPTH_EXCEEDED: 'CATEGORY_MAX_DEPTH_EXCEEDED',
  CATEGORY_CYCLE: 'CATEGORY_CYCLE',
  CATEGORY_HAS_CHILDREN: 'CATEGORY_HAS_CHILDREN',
  CATEGORY_HAS_PRODUCTS: 'CATEGORY_HAS_PRODUCTS',
} as const

export type CategoryErrorCode =
  (typeof CategoryErrors)[keyof typeof CategoryErrors]

// Maximum number of levels in the hierarchy (department → group → subgroup).
export const CATEGORY_MAX_DEPTH = 3
