// Paginated store listing: `page` starts at 1; `search` is free text over name,
// slug and reference address; `isActive` filters by status when defined.
export interface StoreFiltersDTO {
  page: number
  pageSize: number
  search?: string
  isActive?: boolean
}
