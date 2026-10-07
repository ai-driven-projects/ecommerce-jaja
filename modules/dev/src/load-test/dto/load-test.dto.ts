// What a synthetic order can be made of: the products visible in the
// storefront and the users with an active customer record (the only ones who
// can place orders).
export interface LoadTestPoolDTO {
  productIds: string[]
  customerUserIds: string[]
}

// A line of the synthetic cart, as a guest cart would send it.
export interface SyntheticCartItemDTO {
  productId: string
  quantity: number
}

export interface PlanLoadTestOrderInputDTO {
  // Identifies the run (a uuid created by whoever fires the orders); every
  // order of the run carries it in the delivery instructions.
  runId: string
}

// The order a run fires: who places it, the cart and the instructions that
// tag it as an order of the run. Placing it belongs to the orders module.
export interface LoadTestOrderPlanDTO {
  runId: string
  customerUserId: string
  items: SyntheticCartItemDTO[]
  deliveryInstructions: string
}

// An order of a run, as the queue panel reads it. `status` is the text of the
// orders module (`PLACED` ... `DELIVERED`): this module never imports it.
export interface LoadTestRunOrderDTO {
  id: string
  status: string
  placedAt: Date
  // The date of the most recent step, or `placedAt`.
  statusChangedAt: Date
  deliveredAt: Date | null
}

// Every order of a run, from the oldest to the newest, with the count by
// status (only the statuses present).
export interface LoadTestRunDTO {
  runId: string
  total: number
  byStatus: Record<string, number>
  orders: LoadTestRunOrderDTO[]
}
