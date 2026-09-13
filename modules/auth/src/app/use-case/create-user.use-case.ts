import {
  Email,
  PersonName,
  Result,
  ResultError,
  StrongPassword,
  TransactionManager,
  UseCase,
} from '@mentoria-360/shared'
import {
  Password,
  PasswordCryptoProvider,
  PasswordRepository,
} from '../../password'
import { User, UserErrors, UserRepository } from '../../user'

export interface CreateUserInput {
  name: string
  email: string
  password: string
  avatarUrl?: string
}

export class CreateUser implements UseCase<CreateUserInput, void> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordRepository: PasswordRepository,
    private readonly passwordCrypto: PasswordCryptoProvider,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(input: CreateUserInput): Promise<Result<void>> {
    const existing = await this.userRepository.findByEmail(input.email)
    if (existing.isFailure) return existing.withFail
    if (existing.instance) return Result.fail(UserErrors.EMAIL_ALREADY_EXISTS)

    const name = PersonName.tryCreate(input.name)
    if (name.isFailure) return name.withFail

    const email = Email.tryCreate(input.email)
    if (email.isFailure) return email.withFail

    const strongPassword = StrongPassword.tryCreate(input.password)
    if (strongPassword.isFailure) return strongPassword.withFail

    const hash = await this.passwordCrypto.hash(strongPassword.instance.value)

    const user = User.tryCreate({
      name: name.instance.value,
      email: email.instance.value,
      avatarUrl: input.avatarUrl,
      admin: false,
    })
    if (user.isFailure) return user.withFail

    const password = Password.tryCreate({
      userId: user.instance.id,
      value: hash,
    })
    if (password.isFailure) return password.withFail

    try {
      // Throwing inside the callback is what makes the transaction roll back.
      await this.transactionManager.runInTransaction(async (tx) => {
        const createdUser = await this.userRepository.create(user.instance, tx)
        createdUser.validator.throwsIfFailed()

        const createdPassword = await this.passwordRepository.create(
          password.instance,
          tx,
        )
        createdPassword.validator.throwsIfFailed()
      })
      return Result.ok()
    } catch (error) {
      if (error instanceof ResultError) return Result.fail(error.errors)
      throw error
    }
  }
}
