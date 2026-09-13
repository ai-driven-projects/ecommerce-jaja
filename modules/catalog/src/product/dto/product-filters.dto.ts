// Already normalized by the caller: `page` and `pageSize` are integers >= 1
// (`pageSize` capped by the API) and empty strings are omitted.
export interface ProductFiltersDTO {
  page: number
  pageSize: number
  search?: string
  brandId?: string
  categoryId?: string
  isActive?: boolean
}
