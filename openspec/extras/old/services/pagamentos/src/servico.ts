import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type { EventBus } from "@jaja/broker";
import { PagamentoAprovado, PedidoCriado } from "@jaja/contratos";
import { abrirBanco } from "./banco.js";

export function createService({
  bus,
  dbPath,
  port = 3003,
  atrasoMs = 2000,
}: { bus: EventBus; dbPath?: string; port?: number; atrasoMs?: number }) {
  const db = abrirBanco(dbPath);
  const app = Fastify();
  app.register(cors, { origin: true });
  app.get("/saude", async () => ({ ok: true }));

  // Simula um PIX: espera um pouco e aprova sempre. A recusa
  // (pagamento.recusado) vem no prompt 6.
  const cancelarAssinatura = bus.subscribe("pedido.criado", (evento) => {
    const pedido = PedidoCriado.parse(evento);
    setTimeout(async () => {
      const id = randomUUID();
      const agora = new Date().toISOString();
      db.prepare(
        "INSERT INTO pagamentos (id, pedidoId, meio, valorCentavos, aprovadoEm) VALUES (?, ?, 'pix', ?, ?)"
      ).run(id, pedido.pedidoId, pedido.payload.totalCentavos, agora);
      await bus.publish(
        PagamentoAprovado.parse({
          id: randomUUID(),
          tipo: "pagamento.aprovado",
          ocorridoEm: agora,
          pedidoId: pedido.pedidoId,
          payload: { pedidoId: pedido.pedidoId, meio: "pix", valorCentavos: pedido.payload.totalCentavos },
        })
      );
    }, atrasoMs);
  });

  return { app, port, subscriptions: [cancelarAssinatura] };
}
