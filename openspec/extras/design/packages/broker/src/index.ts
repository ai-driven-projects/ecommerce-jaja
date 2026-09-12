// Interface de mensageria do sistema. NÃO pode vazar detalhes de nenhum
// broker concreto (RabbitMQ virá como adapter em prompt futuro).

export interface EventoDominio {
  id: string;
  tipo: string;
  ocorridoEm: string;
  pedidoId?: string;
  payload: unknown;
}

export type Handler = (evento: EventoDominio) => void | Promise<void>;

export interface EventBus {
  publish(evento: EventoDominio): Promise<void>;
  /** Retorna uma função que cancela a assinatura. */
  subscribe(tipo: string, handler: Handler): () => void;
}

/** Adapter em memória — útil para dev e testes. */
export class EventBusMemoria implements EventBus {
  private assinantes = new Map<string, Set<Handler>>();

  async publish(evento: EventoDominio): Promise<void> {
    const handlers = this.assinantes.get(evento.tipo);
    if (!handlers) return;
    for (const handler of handlers) await handler(evento);
  }

  subscribe(tipo: string, handler: Handler): () => void {
    if (!this.assinantes.has(tipo)) this.assinantes.set(tipo, new Set());
    this.assinantes.get(tipo)!.add(handler);
    return () => this.assinantes.get(tipo)?.delete(handler);
  }
}
