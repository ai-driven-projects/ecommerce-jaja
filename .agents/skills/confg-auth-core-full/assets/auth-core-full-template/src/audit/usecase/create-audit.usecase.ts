import { Result, UseCase } from "__SHARED_PACKAGE_NAME__";
import { Audit, AuditProps } from "../model";
import { AuditRepository } from "../provider";

export interface CreateAuditInDTO extends AuditProps {}

export class CreateAuditUseCase implements UseCase<CreateAuditInDTO, void> {
    constructor(private readonly repo: AuditRepository) {}

    async execute(data: CreateAuditInDTO): Promise<Result<void>> {
        return Result.tryAsync(async () => {
            const auditResult = Audit.tryCreate(data);
            auditResult.validator.throwsIfFailed();

            const trySaveResult = await this.repo.create(auditResult.instance);
            trySaveResult.validator.throwsIfFailed();
        });
    }
}
