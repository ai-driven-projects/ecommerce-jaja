import { Entity, EntityProps } from '@mentoria-360/shared'

export interface StoresProps extends EntityProps {}

export class Stores extends Entity<
  Stores,
  StoresProps
> {
  private constructor(props: StoresProps) {
    super(props)
  }

  static create(props: StoresProps): Stores {
    return new Stores(props)
  }
}
