import { Result, UseCase } from '@mentoria-360/shared'
import { Auth } from '../model'
import { AuthRepository } from '../provider'

export interface CreateAuthInput {
  entity: Auth
}

export class CreateAuth
  implements UseCase<CreateAuthInput, void>
{
  constructor(
    private readonly authRepository: AuthRepository,
  ) {}

  async execute(input: CreateAuthInput): Promise<Result<void>> {
    return this.authRepository.create(input.entity)
  }
}
