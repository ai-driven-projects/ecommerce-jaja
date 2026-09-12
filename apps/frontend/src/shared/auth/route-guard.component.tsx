'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

type RouteGuardProps = {
  children: React.ReactNode;
};

type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

const AUTH_TOKEN_KEY = 'auth_token';

function readAuthToken(): string | undefined {
  return (
    localStorage.getItem(AUTH_TOKEN_KEY) ??
    document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${AUTH_TOKEN_KEY}=`))
      ?.split('=')[1]
  );
}

function getClientAuthStatus(): AuthStatus {
  return readAuthToken() ? 'authenticated' : 'unauthenticated';
}

function getServerAuthStatus(): AuthStatus {
  return 'unknown';
}

function subscribeToAuthToken(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/**
 * Guard de rota para páginas privadas.
 * Redireciona para /auth se não houver token de autenticação.
 *
 * TODO: substitua a lógica de verificação pelo mecanismo real de auth do projeto
 * (ex: verificar cookie de sessão, chamar hook useAuth, etc.)
 */
export function RouteGuard({ children }: RouteGuardProps) {
  const router = useRouter();
  const status = useSyncExternalStore(subscribeToAuthToken, getClientAuthStatus, getServerAuthStatus);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    }
  }, [router, status]);

  if (status !== 'authenticated') return null;

  return <>{children}</>;
}
