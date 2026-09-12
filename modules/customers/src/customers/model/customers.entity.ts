import { Entity, EntityProps } from '@mentoria-360/shared'

export interface CustomersProps extends EntityProps {}

export class Customers extends Entity<
  Customers,
  CustomersProps
> {
  private constructor(props: CustomersProps) {
    super(props)
  }

  static create(props: CustomersProps): Customers {
    return new Customers(props)
  }
}
