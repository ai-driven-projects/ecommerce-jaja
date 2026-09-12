import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type { EventBus } from "@jaja/broker";
import {
  EstoqueReservado,
  EstoqueSeparado,
  PagamentoAprovado,
  PedidoConfirmado,
  PedidoCriado,
  type ItemReservado,
} from "@jaja/contratos";
import { abrirBanco } from "./banco.js";

// Todos os atrasos simulados leem JAJA_ESCALA_TEMPO (padrão 1; ver CLAUDE.md).
const ESCALA = Number(process.env.JAJA_ESCALA_TEMPO ?? "1") || 1;

export function createService({
  bus,
  dbPath,
  port = 3004,
  atrasos = {},
}: {
  bus: EventBus;
  dbPath?: string;
  port?: number;
  atrasos?: { reservaMs?: number; separacaoMs?: number };
}) {
  const db = abrirBanco(dbPath);
  const app = Fastify();
  app.register(cors, { origin: true });
  app.get("/saude", async () => ({ ok: true }));

  const reservaMs = (atrasos.reservaMs ?? 1000) * ESCALA;
  const separacaoMs = (atrasos.separacaoMs ?? 4000) * ESCALA;

  const subscriptions = [
    // Guarda hub e itens do pedido para reservar quando o pagamento aprovar.
    bus.subscribe("pedido.criado", (e) => {
      const evento = PedidoCriado.parse(e);
      const itens: ItemReservado[] = evento.payload.itens.map((i) => ({
        produtoId: i.produtoId,
        quantidade: i.quantidade,
      }));
      db.prepare("INSERT OR REPLACE INTO pedidos_pendentes (pedidoId, hub, itens) VALUES (?, ?, ?)").run(
        evento.pedidoId,
        evento.payload.hub,
        JSON.stringify(itens)
      );
    }),

    // Pagamento aprovado → reserva os itens. Sempre dá certo por enquanto;
    // estoque.insuficiente entra no prompt 6.
    bus.subscribe("pagamento.aprovado", (e) => {
      const evento = PagamentoAprovado.parse(e);
      setTimeout(async () => {
        const pendente = db
          .prepare("SELECT hub, itens FROM pedidos_pendentes WHERE pedidoId = ?")
          .get(evento.pedidoId) as { hub: string; itens: string } | undefined;
        if (!pendente) return;
        const itens = JSON.parse(pendente.itens) as ItemReservado[];
        const baixar = db.prepare(
          "UPDATE estoque SET quantidade = MAX(quantidade - ?, 0) WHERE produtoId = ? AND hub = ?"
        );
        db.transaction(() => {
          for (const item of itens) baixar.run(item.quantidade, item.produtoId, pendente.hub);
          db.prepare(
            "INSERT OR REPLACE INTO reservas (pedidoId, hub, itens, reservadoEm) VALUES (?, ?, ?, ?)"
          ).run(evento.pedidoId, pendente.hub, pendente.itens, new Date().toISOString());
        })();
        await bus.publish(
          EstoqueReservado.parse({
            id: randomUUID(),
            tipo: "estoque.reservado",
            ocorridoEm: new Date().toISOString(),
            pedidoId: evento.pedidoId,
            payload: { pedidoId: evento.pedidoId, hub: pendente.hub, itens },
          })
        );
      }, reservaMs);
    }),

    // Pedido confirmado → simula a separação no hub.
    bus.subscribe("pedido.confirmado", (e) => {
      const evento = PedidoConfirmado.parse(e);
      setTimeout(async () => {
        db.prepare("UPDATE reservas SET separadoEm = ? WHERE pedidoId = ?").run(
          new Date().toISOString(),
          evento.pedidoId
        );
        await bus.publish(
          EstoqueSeparado.parse({
            id: randomUUID(),
            tipo: "estoque.separado",
            ocorridoEm: new Date().toISOString(),
            pedidoId: evento.pedidoId,
            payload: { pedidoId: evento.pedidoId, hub: evento.payload.hub },
          })
        );
      }, separacaoMs);
    }),
  ];

  return { app, port, subscriptions };
}
