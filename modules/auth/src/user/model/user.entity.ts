import {
  Email,
  Entity,
  EntityProps,
  Flag,
  Id,
  PersonName,
  Result,
  Url,
} from '@mentoria-360/shared'
import { UserDTO } from '../dto'

export interface UserProps extends EntityProps {
  name: string
  email: string
  avatarUrl?: string | null
  admin?: boolean
}

export class User extends Entity<User, UserProps> {
  private constructor(props: UserProps) {
    super(props)
  }

  static create(props: UserProps): User {
    const result = User.tryCreate(props)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(props: UserProps): Result<User> {
    const id = Id.tryCreate(props.id)
    const name = PersonName.tryCreate(props.name)
    const email = Email.tryCreate(props.email)
    const avatarUrl = Url.tryCreate(props.avatarUrl, { optional: true })
    const admin = Flag.tryCreate(props.admin ?? false)

    const attrs = Result.combine([id, name, email, avatarUrl, admin])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new User({
        ...props,
        id: id.instance.value,
        name: name.instance.value,
        email: email.instance.value,
        avatarUrl: avatarUrl.instance?.value ?? null,
        admin: admin.instance.value,
      }),
    )
  }

  get name(): string {
    return this.props.name
  }

  get email(): string {
    return this.props.email
  }

  get avatarUrl(): string | null {
    return this.props.avatarUrl ?? null
  }

  get isAdmin(): boolean {
    return this.props.admin === true
  }

  toDTO(): UserDTO {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      avatarUrl: this.avatarUrl,
      admin: this.isAdmin,
    }
  }
}
