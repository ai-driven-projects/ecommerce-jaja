// Already normalized by the caller: `page` and `pageSize` are integers >= 1
// (`pageSize` capped by the API) and absent/invalid optional params are omitted.
//
// Paginated flat list of categories of any level:
// - `search`: free text over name, slug and description;
// - `isActive`: filters by status when defined;
// - `maxLevel`: keeps only categories with `level <= maxLevel`;
// - `excludeSubtreeOf`: removes that category and all its descendants.
export interface CategoryFiltersDTO {
  page: number
  pageSize: number
  search?: string
  isActive?: boolean
  maxLevel?: 1 | 2 | 3
  excludeSubtreeOf?: string
}

// Paginated tree of root categories: `expanded` loads the full subtree of each
// root in `children`; otherwise `children` comes empty.
export interface CategoryTreeFilterDTO {
  page: number
  pageSize: number
  expanded: boolean
}
