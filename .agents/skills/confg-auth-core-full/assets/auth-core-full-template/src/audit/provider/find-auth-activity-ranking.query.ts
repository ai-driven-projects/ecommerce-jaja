import { Result } from "__SHARED_PACKAGE_NAME__";
import { AuthActivityRankingItemDTO } from "../dto";

export interface FindAuthActivityRankingQuery {
    execute(): Promise<Result<AuthActivityRankingItemDTO[]>>;
}
