import { Entity, EntityProps } from '@mentoria-360/shared'

export interface OrdersProps extends EntityProps {}

export class Orders extends Entity<
  Orders,
  OrdersProps
> {
  private constructor(props: OrdersProps) {
    super(props)
  }

  static create(props: OrdersProps): Orders {
    return new Orders(props)
  }
}
