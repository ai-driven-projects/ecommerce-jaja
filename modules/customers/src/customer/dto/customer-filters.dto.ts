// Paginated customer listing: `page` starts at 1; `search` is free text over the
// user's name and email, CPF, phone and neighborhood; `isActive` filters by
// status when defined.
export interface CustomerFiltersDTO {
  page: number
  pageSize: number
  search?: string
  isActive?: boolean
}
