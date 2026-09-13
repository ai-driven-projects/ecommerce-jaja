import { Result } from "__SHARED_PACKAGE_NAME__";
import { AuthLoginTimelinePointDTO } from "../dto";

export interface FindAuthLoginTimelineQuery {
    execute(): Promise<Result<AuthLoginTimelinePointDTO[]>>;
}
