import { Entity, EntityProps } from '@mentoria-360/shared'

export interface AuthProps extends EntityProps {}

export class Auth extends Entity<
  Auth,
  AuthProps
> {
  private constructor(props: AuthProps) {
    super(props)
  }

  static create(props: AuthProps): Auth {
    return new Auth(props)
  }
}
