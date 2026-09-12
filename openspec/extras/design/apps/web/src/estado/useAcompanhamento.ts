import { useEffect, useRef, useState } from "react";

export type EventoPedido = {
  eventoId: string;
  pedidoId: string;
  tipo: string;
  ocorridoEm: string;
  payload: Record<string, unknown> | null;
};

/**
 * Conecta ao SSE do pedido. Render idempotente: os eventos ficam indexados
 * por eventoId — o mesmo evento chegando duas vezes não duplica nada. Se a
 * conexão cair, o EventSource reconecta sozinho e o servidor reenvia o
 * histórico inteiro; a indexação absorve as repetições.
 * `vivos` marca eventos que chegaram ao vivo (fora do histórico inicial),
 * para a tela animar só o que acabou de acontecer.
 */
export function useAcompanhamento(pedidoId: string | undefined) {
  const [porId, setPorId] = useState<Record<string, EventoPedido>>({});
  const [vivos, setVivos] = useState<Record<string, true>>({});
  const abertoEm = useRef(0);

  useEffect(() => {
    if (!pedidoId) return;
    setPorId({});
    setVivos({});
    const fonte = new EventSource("/api/pedidos/" + pedidoId + "/stream");
    fonte.onopen = () => {
      abertoEm.current = Date.now();
    };
    fonte.onmessage = (msg) => {
      const evento = JSON.parse(msg.data) as EventoPedido;
      const aoVivo = Date.now() - abertoEm.current > 1000;
      setPorId((atual) => (atual[evento.eventoId] ? atual : { ...atual, [evento.eventoId]: evento }));
      if (aoVivo) setVivos((atual) => (atual[evento.eventoId] ? atual : { ...atual, [evento.eventoId]: true }));
    };
    return () => fonte.close();
  }, [pedidoId]);

  const eventos = Object.values(porId).sort(
    (a, b) => a.ocorridoEm.localeCompare(b.ocorridoEm) || a.eventoId.localeCompare(b.eventoId)
  );
  return { eventos, vivos };
}
