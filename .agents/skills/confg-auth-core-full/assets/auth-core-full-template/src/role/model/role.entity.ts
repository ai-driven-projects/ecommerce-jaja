import { Id, Entity, EntityProps, Result, Text } from "__SHARED_PACKAGE_NAME__";

const ROLE_NAME_CONFIG = { minLength: 3, maxLength: 120 } as const;

export interface RoleProps extends EntityProps {
    name: string;
    description: string;
    permissionIds: string[];
}

export class Role extends Entity<Role, RoleProps> {
    private constructor(props: RoleProps) {
        super(props);
    }

    get name(): string {
        return this.props.name;
    }
    get description(): string {
        return this.props.description;
    }
    get permissionIds(): string[] {
        return this.props.permissionIds;
    }

    public static create(props: RoleProps): Role {
        const result = Role.tryCreate(props);
        result.validator.throwsIfFailed();
        return result.instance;
    }

    static tryCreate(props: RoleProps): Result<Role> {
        const id = Id.tryCreate(props.id);
        const name = Text.tryCreate(props.name, ROLE_NAME_CONFIG);
        const permissionIds =
            props.permissionIds?.map((pid) => Id.tryCreate(pid)) ?? [];

        const attributes = Result.combine([id, name, ...permissionIds]);

        if (attributes.isFailure) {
            return Result.fail(attributes.errors!);
        }

        return Result.ok(
            new Role({
                ...props,
                id: id.instance.value,
                name: name.instance.value,
                description: props.description,
                permissionIds: props.permissionIds ?? [],
            }),
        );
    }
}
