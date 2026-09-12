import { Entity, EntityProps } from '@mentoria-360/shared'

export interface CatalogProps extends EntityProps {}

export class Catalog extends Entity<
  Catalog,
  CatalogProps
> {
  private constructor(props: CatalogProps) {
    super(props)
  }

  static create(props: CatalogProps): Catalog {
    return new Catalog(props)
  }
}
