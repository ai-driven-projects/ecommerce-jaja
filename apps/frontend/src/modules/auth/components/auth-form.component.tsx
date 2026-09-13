'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { LoginForm } from './login-form.component';
import { RegisterForm } from './register-form.component';
import type { AuthUser } from '../data/auth.types';

export type AuthMode = 'login' | 'register';

type AuthFormProps = {
  defaultMode?: AuthMode;
  /** Chamado nas duas abas com o usuário autenticado e o modo que o produziu. */
  onSignedIn: (user: AuthUser, mode: AuthMode) => void;
};

/**
 * Abas "Entrar" / "Criar conta" sobre os formulários compartilhados. O registro
 * já autentica em seguida, então as duas abas terminam no mesmo callback e
 * quem aplica a regra de destino (admin ou loja) é a página que o contém.
 */
export function AuthForm({ defaultMode = 'login', onSignedIn }: AuthFormProps) {
  return (
    <Tabs defaultValue={defaultMode}>
      <TabsList aria-label="Entrar ou criar conta" className="grid w-full grid-cols-2">
        <TabsTrigger value="login">Entrar</TabsTrigger>
        <TabsTrigger value="register">Criar conta</TabsTrigger>
      </TabsList>
      <TabsContent value="login" className="mt-5">
        <LoginForm onSuccess={(user) => onSignedIn(user, 'login')} />
      </TabsContent>
      <TabsContent value="register" className="mt-5">
        <RegisterForm onSuccess={(user) => onSignedIn(user, 'register')} />
      </TabsContent>
    </Tabs>
  );
}
