import { Result } from "__SHARED_PACKAGE_NAME__";
import { AuthTopFailedEmailDTO } from "../dto";

export interface FindAuthTopFailedEmailsQuery {
    execute(): Promise<Result<AuthTopFailedEmailDTO[]>>;
}
