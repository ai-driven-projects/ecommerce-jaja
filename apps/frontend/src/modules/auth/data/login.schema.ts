import { Email, StrongPassword } from '@mentoria-360/shared';
import { v } from '@/shared/components/form/validator';

/** Validação do login administrativo: email válido e senha dentro da política forte. */
export const loginSchema = v.defineObject({
  email: Email,
  password: StrongPassword,
});

export type LoginFormData = v.infer<typeof loginSchema>;
