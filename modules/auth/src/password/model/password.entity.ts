import {
  Entity,
  EntityProps,
  Id,
  Password as PasswordHash,
  Result,
} from '@mentoria-360/shared'
import { PasswordDTO } from '../dto'
import { PasswordErrors } from '../errors'

export interface PasswordProps extends EntityProps {
  userId: string
  value: string
}

export class Password extends Entity<Password, PasswordProps> {
  private constructor(props: PasswordProps) {
    super(props)
  }

  static create(props: PasswordProps): Password {
    const result = Password.tryCreate(props)
    result.validator.throwsIfFailed()
    return result.instance
  }

  static tryCreate(props: PasswordProps): Result<Password> {
    const id = Id.tryCreate(props.id)
    const userId = Id.required(props.userId)
    const value = Password.tryCreateHash(props.value)

    const attrs = Result.combine([id, userId, value])
    if (attrs.isFailure) return Result.fail(attrs.errors)

    return Result.ok(
      new Password({
        ...props,
        id: id.instance.value,
        userId: userId.instance.value,
        value: value.instance.value,
      }),
    )
  }

  // Shared `Password` only rejects empty values; the bcrypt format is enforced here.
  private static tryCreateHash(value: string): Result<PasswordHash> {
    const hash = PasswordHash.tryCreate(value)
    if (hash.isFailure) return hash
    if (!PasswordHash.isHash(hash.instance.value)) {
      return Result.fail(PasswordErrors.NOT_HASHED)
    }
    return hash
  }

  get userId(): string {
    return this.props.userId
  }

  get value(): string {
    return this.props.value
  }

  toDTO(): PasswordDTO {
    return { id: this.id, userId: this.userId }
  }
}
