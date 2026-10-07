'use client';

import { useCallback, useState } from 'react';
import { LiveIndicator } from '@/modules/orders/components/live-indicator.component';
import { useOrdersLive } from '@/modules/orders/data/orders-live.context';
import { Badge } from '@/shared/components/ui/badge';
import { PageSectionHeader } from '@/shared/components/ui/page-section-header';
import { API_URL } from '@/shared/util/api-client.util';
import { useLoadTestGenerator } from '../data/use-load-test-generator.hook';
import { useLoadTestPool } from '../data/use-load-test-pool.hook';
import { useLoadTestQueue } from '../data/use-load-test-queue.hook';
import { LoadTestGenerator } from './load-test-generator.component';
import { LoadTestQueue } from './load-test-queue.component';

/** Host da API em uso (ex.: `api.jaja.cod3r.com.br`), para não esquecer contra qual ambiente o teste roda. */
function apiHost(): string {
  try {
    return new URL(API_URL).host;
  } catch {
    return API_URL || 'mesma origem';
  }
}

/**
 * Teste de carga de pedidos (`/admin/dev`), numa tela só: o gerador à esquerda
 * (dispara N pedidos de uma vez e mede a API) e a fila à direita (os pedidos da
 * execução sendo processados ao vivo até a entrega). A fila segue a execução
 * mais recente, ou a escolhida no histórico do gerador.
 */
export function LoadTestDashboard() {
  const { status: liveStatus } = useOrdersLive();
  const [followedRunId, setFollowedRunId] = useState<string | null>(null);
  const follow = useCallback((runId: string) => setFollowedRunId(runId), []);

  const pool = useLoadTestPool();
  const generator = useLoadTestGenerator({ onRunStart: follow });
  const queue = useLoadTestQueue(followedRunId);

  const unavailable = pool.disabled || (pool.error && !pool.loading) ? pool.error : null;

  return (
    <div className="flex flex-col gap-[22px]">
      <PageSectionHeader
        title="Teste de carga"
        subtitle="Dispare pedidos simultâneos e acompanhe a fila sendo processada até a entrega."
        aside={
          <>
            <Badge variant="outline" title="NEXT_PUBLIC_API_URL">
              API: {apiHost()}
            </Badge>
            <LiveIndicator status={liveStatus} />
          </>
        }
      />

      <div className="grid items-start gap-[22px] xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
        <LoadTestGenerator
          pool={pool.pool}
          unavailable={unavailable}
          current={generator.current}
          history={generator.history}
          running={generator.running}
          canStart={generator.canStart}
          followedRunId={followedRunId}
          onStart={generator.start}
          onStop={generator.stop}
          onFollow={follow}
        />
        <LoadTestQueue
          runId={followedRunId}
          run={queue.run}
          numbers={queue.numbers}
          samples={queue.samples}
          error={queue.error}
          loading={queue.loading}
        />
      </div>
    </div>
  );
}
