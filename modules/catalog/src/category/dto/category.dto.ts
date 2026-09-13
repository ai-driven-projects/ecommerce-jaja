// Read projection of a category. `level` (1 = root, 2 = child, 3 = grandchild),
// `path` (ancestor names and its own, joined by " / ") and `childrenCount`
// (direct non-deleted children) are computed by the read side and never
// persisted. `level` and `path` always consider every ancestor, even one that
// does not pass the filters of the query.
export interface CategoryDTO {
  id: string
  name: string
  slug: string
  description: string | null
  parentId: string | null
  order: number
  isHighlighted: boolean
  imageUrl: string | null
  isActive: boolean
  level: number
  path: string
  childrenCount: number
  createdAt: Date
  updatedAt: Date
}

// Category inside a tree. `children` holds the loaded direct children (ordered
// by `order`, then name); it is `[]` when they were not loaded, in which case
// `childrenCount` tells whether there is anything to load.
export interface CategoryTreeNodeDTO extends CategoryDTO {
  children: CategoryTreeNodeDTO[]
}

// One page of the flat category list; `totalPages` is `ceil(total / pageSize)`.
export interface CategoryPageDTO {
  items: CategoryDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// One page of root categories as trees; `total` and `totalPages` count only
// the roots.
export interface CategoryTreePageDTO {
  items: CategoryTreeNodeDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
