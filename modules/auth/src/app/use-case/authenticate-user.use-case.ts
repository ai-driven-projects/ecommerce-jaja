import { Email, Result, UseCase } from '@mentoria-360/shared'
import { PasswordCryptoProvider, PasswordRepository } from '../../password'
import { UserDTO, UserErrors, UserRepository } from '../../user'

export interface AuthenticateUserInput {
  email: string
  password: string
}

export class AuthenticateUser
  implements UseCase<AuthenticateUserInput, UserDTO>
{
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordRepository: PasswordRepository,
    private readonly passwordCrypto: PasswordCryptoProvider,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<Result<UserDTO>> {
    const email = Email.tryCreate(input.email)
    if (email.isFailure) return email.withFail

    const user = await this.userRepository.findByEmail(email.instance.value)
    if (user.isFailure) return user.withFail
    if (!user.instance) return Result.fail(UserErrors.INVALID_CREDENTIALS)

    const password = await this.passwordRepository.findByUserId(
      user.instance.id,
    )
    if (password.isFailure) return password.withFail
    if (!password.instance) return Result.fail(UserErrors.INVALID_CREDENTIALS)

    const matches = await this.passwordCrypto.compare(
      input.password,
      password.instance.value,
    )
    if (!matches) return Result.fail(UserErrors.INVALID_CREDENTIALS)

    return Result.ok(user.instance.toDTO())
  }
}
