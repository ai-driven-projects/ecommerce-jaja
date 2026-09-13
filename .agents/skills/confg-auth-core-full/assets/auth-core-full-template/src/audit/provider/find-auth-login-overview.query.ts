import { Result } from "__SHARED_PACKAGE_NAME__";
import { AuthLoginOverviewMetricsDTO } from "../dto";

export interface FindAuthLoginOverviewQuery {
    execute(): Promise<Result<AuthLoginOverviewMetricsDTO>>;
}
