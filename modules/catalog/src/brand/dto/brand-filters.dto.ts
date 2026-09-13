// Paginated brand listing: `page` starts at 1; `search` is free text over name,
// slug and description; `isActive` filters by status when defined.
export interface BrandFiltersDTO {
  page: number
  pageSize: number
  search?: string
  isActive?: boolean
}
