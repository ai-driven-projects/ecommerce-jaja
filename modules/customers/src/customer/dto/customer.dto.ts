// Point of the address on the map, in decimal degrees rounded to 6 places.
export interface CustomerLocationDTO {
  latitude: number
  longitude: number
}

// Delivery address as stored: `zipCode` with 8 digits, `state` uppercase,
// `complement` as `null` when absent and `location` as `null` when the customer
// has not marked a point on the map.
export interface CustomerAddressDTO {
  zipCode: string
  street: string
  number: string
  complement: string | null
  neighborhood: string
  city: string
  state: string
  location: CustomerLocationDTO | null
}

// Returned by `Customer.toDTO()` and `SaveCustomer`. The domain only knows the
// `userId`: name and email belong to the user and come from the read side.
export interface CustomerDTO {
  id: string
  userId: string
  cpf: string
  phone: string
  address: CustomerAddressDTO
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Returned by the detail queries: the customer plus `name` and `email` of the
// linked user.
export interface CustomerDetailDTO extends CustomerDTO {
  name: string
  email: string
}

// One row of the paginated listing.
export interface CustomerListItemDTO {
  id: string
  name: string
  email: string
  cpf: string
  phone: string
  neighborhood: string
  city: string
  state: string
  isActive: boolean
}

// One page of customers; `totalPages` is `ceil(total / pageSize)`.
export interface CustomerPageDTO {
  items: CustomerListItemDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
