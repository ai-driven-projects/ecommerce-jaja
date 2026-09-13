'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { login, register } from './auth.api';
import { clearAuthSession, readAuthSession, writeAuthSession } from './auth-storage';
import type { AuthSession, AuthUser, RegisterInput } from './auth.types';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (input: RegisterInput) => Promise<AuthUser>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Estado de sessão da aplicação. O inicializador lê o cookie de forma síncrona:
 * no servidor não há `document` e o estado nasce `null`; no cliente nasce já
 * com a sessão, sem `useEffect` de inicialização nem render intermediário.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(readAuthSession);

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await login(email, password);
    writeAuthSession(next);
    setSession(next);
    return next.user;
  }, []);

  /** Registro sempre autentica em seguida: `register` + `signIn` com as mesmas credenciais. */
  const signUp = useCallback(
    async (input: RegisterInput) => {
      await register(input);
      return signIn(input.email, input.password);
    },
    [signIn],
  );

  const signOut = useCallback(() => {
    clearAuthSession();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: session !== null,
      isAdmin: session?.user.admin === true,
      signIn,
      signUp,
      signOut,
    }),
    [session, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  }
  return context;
}
