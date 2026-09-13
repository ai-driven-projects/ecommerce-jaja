import { Email, PersonName } from "__SHARED_PACKAGE_NAME__";
import { v } from "@/shared";

export const updateProfileSchema = v.defineObject({
    name: PersonName,
    email: Email,
});

export type UpdateProfileFormData = v.infer<typeof updateProfileSchema>;
