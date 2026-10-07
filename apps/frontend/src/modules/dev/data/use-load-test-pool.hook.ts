'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/modules/auth/data/auth.context';
import { ApiError, toErrorMessage } from '@/shared/util/api-client.util';
import { getLoadTestPool, type LoadTestPoolSummary } from './load-test.api';

const OUTDATED_API_MESSAGE =
  'Esta API ainda não tem o módulo de desenvolvimento: faça o deploy do backend com DEV_TOOLS_ENABLED="true".';

type PoolState = {
  token: string;
  pool: LoadTestPoolSummary | null;
  /** `true` no `404`: ferramentas desligadas (`DEV_TOOLS_DISABLED`) ou API sem o módulo. */
  disabled: boolean;
  error: string | null;
};

/**
 * Tamanho do sorteio do teste de carga (`GET /dev/load-test/pool`), lido uma vez
 * por sessão. Diz também se a API tem as ferramentas ligadas (`disabled`).
 */
export function useLoadTestPool() {
  const { session } = useAuth();
  const token = session?.token;
  const [state, setState] = useState<PoolState | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;

    getLoadTestPool(token)
      .then((pool) => {
        if (active) setState({ token, pool, disabled: false, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const disabled = error instanceof ApiError && error.status === 404;
        // 404 sem `DEV_TOOLS_DISABLED`: a API em uso é anterior ao módulo de desenvolvimento.
        const outdated = disabled && !(error as ApiError).codes.includes('DEV_TOOLS_DISABLED');
        setState({ token, pool: null, disabled, error: outdated ? OUTDATED_API_MESSAGE : toErrorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, [token]);

  const current = token && state?.token === token ? state : null;
  return {
    pool: current?.pool ?? null,
    disabled: current?.disabled ?? false,
    error: current?.error ?? null,
    loading: Boolean(token) && current === null,
  };
}
