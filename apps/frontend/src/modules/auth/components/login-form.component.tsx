'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui/button';
import { FormErrorMessage } from '@/shared/components/ui/form-error-message';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { v } from '@/shared/components/form/validator';
import { useAuth } from '../data/auth.context';
import { loginSchema, type LoginFormData } from '../data/login.schema';
import type { AuthUser } from '../data/auth.types';

const FALLBACK_ERROR_MESSAGE = 'Não foi possível entrar. Tente novamente.';

type LoginFormProps = {
  /** Chamado com o usuário autenticado; quem decide o destino é a página. */
  onSuccess: (user: AuthUser) => void;
  defaultEmail?: string;
};

/**
 * Formulário de login compartilhado. Valida no cliente com o schema
 * (`Email` + `StrongPassword`), chama `signIn` e devolve o usuário por
 * `onSuccess`, sem redirecionar nem verificar `admin`.
 */
export function LoginForm({ onSuccess, defaultEmail = '' }: LoginFormProps) {
  const { signIn } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: v.resolver(loginSchema),
    defaultValues: { email: defaultEmail, password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setApiError(null);

    try {
      const user = await signIn(data.email, data.password);
      onSuccess(user);
    } catch (error) {
      setApiError(error instanceof Error && error.message ? error.message : FALLBACK_ERROR_MESSAGE);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <div>
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
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
        <Label htmlFor="login-password">Senha</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={errors.password ? true : undefined}
          disabled={isSubmitting}
          {...register('password')}
        />
        {errors.password?.message ? (
          <FormErrorMessage className="mt-1.5">{errors.password.message}</FormErrorMessage>
        ) : null}
      </div>

      {apiError ? <FormErrorMessage size="sm">{apiError}</FormErrorMessage> : null}

      <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1 w-full">
        {isSubmitting ? 'entrando...' : 'Entrar'}
      </Button>
    </form>
  );
}
