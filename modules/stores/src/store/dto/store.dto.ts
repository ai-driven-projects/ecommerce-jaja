// `phone` has only digits; `latitude`/`longitude` are decimal degrees rounded to
// 6 places; `deliveryRadiusMeters` is in meters, in a straight line.
export interface StoreDTO {
  id: string
  name: string
  slug: string
  phone: string | null
  address: string | null
  latitude: number
  longitude: number
  deliveryRadiusMeters: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// One page of stores; `totalPages` is `ceil(total / pageSize)`.
export interface StorePageDTO {
  items: StoreDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
