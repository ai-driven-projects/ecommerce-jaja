import { Result } from "__SHARED_PACKAGE_NAME__";
import { AuthAlertBoardItemDTO } from "../dto";

export interface FindAuthAlertBoardQuery {
    execute(): Promise<Result<AuthAlertBoardItemDTO[]>>;
}
