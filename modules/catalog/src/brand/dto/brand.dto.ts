export interface BrandDTO {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// One page of brands; `totalPages` is `ceil(total / pageSize)`.
export interface BrandPageDTO {
  items: BrandDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
