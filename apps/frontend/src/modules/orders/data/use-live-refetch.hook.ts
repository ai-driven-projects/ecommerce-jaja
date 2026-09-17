'use client';

import { useEffect } from 'react';
import { createCoalescedRead } from './coalesced-read.util';
import { useOrdersLive } from './orders-live.context';

/**
 * Leitura de uma tela ao vivo. Recebe `isCurrent`, que passa a devolver `false`
 * quando a leitura fica velha (outra sessão, outros filtros, tela desmontada):
 * a resposta de uma leitura velha MUST ser descartada, sem mudar o estado.
 */
export type LiveLoad = (isCurrent: () => boolean) => Promise<void>;

export type UseLiveRefetchOptions = {
  /** Só os avisos deste pedido disparam a releitura (as reconexões sempre disparam). */
  orderId?: string;
};

/**
 * Mantém uma tela do admin em dia com o stream administrativo (`useOrdersLive`):
 *
 * - lê com `load` ao montar e sempre que `load` muda (a identidade de `load` é a
 *   chave da leitura: memorize-o com as dependências, como sessão e filtros);
 *   `null` não lê (ex.: sem sessão);
 * - relê a cada aviso, só dos avisos de `orderId` quando informado, e a cada
 *   reconexão (`{ reconnected: true }`);
 * - no máximo uma leitura em andamento e uma pendente (`createCoalescedRead`):
 *   uma rajada de avisos gera no máximo duas leituras, e a última começa depois do
 *   último aviso;
 * - ao trocar `load`/`orderId` ou desmontar, cancela a inscrição, descarta a
 *   pendente e marca a leitura em andamento como velha (`isCurrent`).
 *
 * Os erros são tratados por `load` (a tela decide entre manter os dados e avisar).
 */
export function useLiveRefetch(load: LiveLoad | null, { orderId }: UseLiveRefetchOptions = {}): void {
  const { subscribe } = useOrdersLive();

  useEffect(() => {
    if (!load) return;

    let active = true;
    const isCurrent = () => active;
    const reader = createCoalescedRead(() => load(isCurrent));

    reader.run();
    const unsubscribe = subscribe((notice) => {
      if ('reconnected' in notice || orderId === undefined || notice.orderId === orderId) reader.run();
    });

    return () => {
      active = false;
      reader.stop();
      unsubscribe();
    };
  }, [load, orderId, subscribe]);
}
