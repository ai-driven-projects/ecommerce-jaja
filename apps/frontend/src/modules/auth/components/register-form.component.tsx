'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui/button';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { v } from '@/shared/components/form/validator';
import { useAuth } from '../data/auth.context';
import { registerSchema, type RegisterFormData } from '../data/register.schema';
import type { AuthUser } from '../data/auth.types';

const FALLBACK_ERROR_MESSAGE = 'Não foi possível criar a conta. Tente novamente.';

type RegisterFormProps = {
  /** Chamado com o usuário já autenticado após o registro; quem decide o destino é a página. */
  onSuccess: (user: AuthUser) => void;
};

/**
 * Formulário de registro compartilhado. Valida no cliente (nome com sobrenome,
 * email, senha forte e confirmação igual), chama `signUp` (registro + login)
 * e devolve o usuário por `onSuccess`, sem redirecionar nem verificar `admin`.
 */
export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { signUp } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: v.resolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setApiError(null);

    try {
      const user = await signUp({ name: data.name, email: data.email, password: data.password });
      onSuccess(user);
    } catch (error) {
      setApiError(error instanceof Error && error.message ? error.message : FALLBACK_ERROR_MESSAGE);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div>
        <Label htmlFor="register-name">Nome</Label>
        <Input
          id="register-name"
          type="text"
          autoComplete="name"
          placeholder="Nome e sobrenome"
          aria-invalid={errors.name ? true : undefined}
          disabled={isSubmitting}
          {...register('name')}
        />
        {errors.name?.message ? <FormErrorMessage className="mt-1.5">{errors.name.message}</FormErrorMessage> : null}
      </div>

      <div>
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          placeholder="voce@empresa.com"
          aria-invalid={errors.email ? true : undefined}
          disabled={isSubmitting}
          {...register('email')}
        />
        {errors.email?.message ? <FormErrorMessage className="mt-1.5">{errors.email.message}</FormErrorMessage> : null}
      </div>

      <div>
        <Label htmlFor="register-password">Senha</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={errors.password ? true : undefined}
          disabled={isSubmitting}
          {...register('password')}
        />
        {errors.password?.message ? (
          <FormErrorMessage className="mt-1.5">{errors.password.message}</FormErrorMessage>
        ) : null}
      </div>

      <div>
        <Label htmlFor="register-confirm-password">Confirmar senha</Label>
        <Input
          id="register-confirm-password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          aria-invalid={errors.confirmPassword ? true : undefined}
          disabled={isSubmitting}
          {...register('confirmPassword')}
        />
        {errors.confirmPassword?.message ? (
          <FormErrorMessage className="mt-1.5">{errors.confirmPassword.message}</FormErrorMessage>
        ) : null}
      </div>

      {apiError ? <FormErrorMessage size="sm">{apiError}</FormErrorMessage> : null}

      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? 'criando conta...' : 'Criar conta'}
      </Button>
    </form>
  );
}
