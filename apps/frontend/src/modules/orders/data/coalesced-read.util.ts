/**
 * Leituras sem sobreposição: com uma leitura em andamento, os pedidos seguintes
 * viram **uma** leitura pendente, feita quando a atual termina. Uma rajada de
 * avisos gera no máximo duas leituras, e a última sempre começa depois do último
 * aviso. `stop` descarta a pendente e ignora novos pedidos.
 *
 * Usado pelo acompanhamento do cliente (`useMyOrder`) e pelas telas ao vivo do
 * admin (`useLiveRefetch`).
 */
export function createCoalescedRead(read: () => Promise<void>) {
  let running = false;
  let pending = false;
  let stopped = false;

  const run = () => {
    if (stopped) return;
    if (running) {
      pending = true;
      return;
    }
    running = true;
    void read().finally(() => {
      running = false;
      if (pending && !stopped) {
        pending = false;
        run();
      }
    });
  };

  return {
    run,
    stop: () => {
      stopped = true;
      pending = false;
    },
  };
}
