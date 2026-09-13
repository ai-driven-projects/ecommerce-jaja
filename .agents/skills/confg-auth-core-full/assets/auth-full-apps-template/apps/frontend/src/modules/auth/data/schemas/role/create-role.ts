import { Id, ShortDescription, Text } from "__SHARED_PACKAGE_NAME__";
import { v } from "@/shared";

export const createRoleSchema = v.defineObject({
    name: { vo: Text, config: { minLength: 3, maxLength: 120 } },
    description: ShortDescription,
    permissionIds: v.defineArray(Id, { optional: true }),
});

export type CreateRoleFormData = v.infer<typeof createRoleSchema>;
