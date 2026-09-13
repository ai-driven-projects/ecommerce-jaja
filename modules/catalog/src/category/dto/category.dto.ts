// Read projection of a category. `level` (1 = root, 2 = child, 3 = grandchild)
// and `path` (ancestor names and its own, joined by " / ") are computed by the
// read side and never persisted.
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
  createdAt: Date
  updatedAt: Date
}
