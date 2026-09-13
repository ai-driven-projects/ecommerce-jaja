import { Email, PersonName, StrongPassword } from '@mentoria-360/shared';
import { v } from '@/shared/components/form/validator';

/**
 * Validação do registro: nome com sobrenome, email válido, senha forte e
 * confirmação igual à senha (refinamento cruzado apontado para `confirmPassword`).
 */
export const registerSchema = v
  .defineObject({
    name: PersonName,
    email: Email,
    password: StrongPassword,
    confirmPassword: StrongPassword,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não conferem',
    field: 'confirmPassword',
  });

export type RegisterFormData = v.infer<typeof registerSchema>;
