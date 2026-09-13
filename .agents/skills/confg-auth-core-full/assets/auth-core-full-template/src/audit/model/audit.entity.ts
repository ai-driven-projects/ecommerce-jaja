import { Entity, EntityProps, Id, Result } from "__SHARED_PACKAGE_NAME__";
import { CriticalityLevel } from "../../permission/model";

export type AuditCriticality = CriticalityLevel | "N/A";

export interface AuditProps extends EntityProps {
    type: string;
    occurredAt: Date;
    method: string;
    endpoint: string;
    userId?: string | null;
    userEmail?: string | null;
    permissionId?: string | null;
    permissionAlias?: string | null;
    action: string;
    criticality: AuditCriticality;
    statusCode?: number | null;
    durationMs: number;
}

export class Audit extends Entity<Audit, AuditProps> {
    private constructor(props: AuditProps) {
        super(props);
    }

    get type(): string {
        return this.props.type;
    }

    get occurredAt(): Date {
        return this.props.occurredAt;
    }

    get method(): string {
        return this.props.method;
    }

    get endpoint(): string {
        return this.props.endpoint;
    }

    get userId(): string | null | undefined {
        return this.props.userId;
    }

    get userEmail(): string | null | undefined {
        return this.props.userEmail;
    }

    get permissionId(): string | null | undefined {
        return this.props.permissionId;
    }

    get permissionAlias(): string | null | undefined {
        return this.props.permissionAlias;
    }

    get action(): string {
        return this.props.action;
    }

    get criticality(): AuditCriticality {
        return this.props.criticality;
    }

    get statusCode(): number | null | undefined {
        return this.props.statusCode;
    }

    get durationMs(): number {
        return this.props.durationMs;
    }

    public static create(props: AuditProps): Audit {
        const result = Audit.tryCreate(props);
        result.validator.throwsIfFailed();
        return result.instance;
    }

    static tryCreate(props: AuditProps): Result<Audit> {
        const idResult = Id.tryCreate(props.id);
        if (idResult.isFailure) {
            return Result.fail(idResult.errors!);
        }

        return Result.ok(
            new Audit({
                ...props,
                durationMs: Number(props.durationMs),
            }),
        );
    }
}
