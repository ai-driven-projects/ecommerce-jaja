'use client';

import type { EventStreamStatus } from '@/shared/util/event-stream.util';

type LiveIndicatorProps = {
  /** Estado do stream, ou `off` quando a tela não tem stream (ex.: pedido entregue no acompanhamento). */
  status: EventStreamStatus | 'off';
  /**
   * Oculta o indicador sem stream (`off`) e com o stream encerrado (`closed`),
   * como no acompanhamento do cliente. Sem a prop (admin), os dois mostram "Desconectado".
   */
  hideWhenOff?: boolean;
};

/**
 * Indicador de atualização ao vivo, ao lado de títulos:
 * - `live`: bolinha verde pulsando com "Ao vivo" (sem pulso com `prefers-reduced-motion`);
 * - `connecting`/`reconnecting`: bolinha cinza com "Reconectando…";
 * - `closed`/`off`: bolinha vermelha com "Desconectado", ou nada com `hideWhenOff`.
 *
 * Compartilhado pelo acompanhamento do cliente e pela área administrativa.
 */
export function LiveIndicator({ status, hideWhenOff = false }: LiveIndicatorProps) {
  if (status === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-extrabold text-success">
        <span className="size-2 rounded-full bg-success motion-safe:animate-pulse-soft" aria-hidden="true" />
        Ao vivo
      </span>
    );
  }

  if (status === 'connecting' || status === 'reconnecting') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted-ink">
        <span className="size-2 rounded-full bg-placeholder" aria-hidden="true" />
        Reconectando…
      </span>
    );
  }

  if (hideWhenOff) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-danger">
      <span className="size-2 rounded-full bg-danger" aria-hidden="true" />
      Desconectado
    </span>
  );
}
