'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type RouteGuardProps = {
  children: React.ReactNode;
};

/**
 * Guard de rota para páginas privadas.
 * Redireciona para /auth/sign-in se não houver token de autenticação.
 *
 * TODO: substitua a lógica de verificação pelo mecanismo real de auth do projeto
 * (ex: verificar cookie de sessão, chamar hook useAuth, etc.)
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token =
      localStorage.getItem('auth_token') ??
      document.cookie
        .split('; ')
        .find((row) => row.startsWith('auth_token='))
        ?.split('=')[1];

    if (!token) {
      router.replace('/auth/sign-in');
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  if (!isAuthorized) return null;

  return <>{children}</>;
}
