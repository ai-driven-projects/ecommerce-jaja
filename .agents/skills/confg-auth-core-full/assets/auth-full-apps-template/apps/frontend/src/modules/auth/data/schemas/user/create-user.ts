import { Email, PersonName, StrongPassword } from "__SHARED_PACKAGE_NAME__";
import { v } from "@/shared";

export const createUserSchema = v
    .defineObject({
        name: PersonName,
        email: Email,
        password: StrongPassword,
        confirmPassword: StrongPassword,
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "As senhas não coincidem.",
        field: "confirmPassword",
    });

export type CreateUserFormData = v.infer<typeof createUserSchema>;
