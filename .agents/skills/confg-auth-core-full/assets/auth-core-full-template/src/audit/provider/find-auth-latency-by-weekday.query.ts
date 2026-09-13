import { Result } from "__SHARED_PACKAGE_NAME__";
import { AuthLatencyByWeekdayDTO } from "../dto";

export interface FindAuthLatencyByWeekdayQuery {
    execute(): Promise<Result<AuthLatencyByWeekdayDTO[]>>;
}
