import { Email, Id, PersonName } from "__SHARED_PACKAGE_NAME__";
import { v } from "@/shared";

export const editUserSchema = v.defineObject({
    id: Id,
    name: PersonName,
    email: Email,
    roleIds: v.defineArray(Id, { min: 1 }),
});

export type EditUserFormData = v.infer<typeof editUserSchema>;
