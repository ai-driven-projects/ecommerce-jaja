import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type { EventBus } from "@jaja/broker";
import { EntregaConcluida, NotificacaoEnviada, PedidoConfirmado } from "@jaja/contratos";
import { abrirBanco } from "./banco.js";

// Terceiro consumidor do pedido.confirmado: o fan-out (estoque + entregas +
// notificacoes reagindo ao MESMO evento) precisa ficar visível em aula.
export function createService({
  bus,
  dbPath,
  port = 3006,
}: { bus: EventBus; dbPath?: string; port?: number }) {
  const db = abrirBanco(dbPath);
  const app = Fastify();
  app.register(cors, { origin: true });
  app.get("/saude", async () => ({ ok: true }));

  // "Envia" registrando no banco e no console — canal de verdade fica pro futuro.
  const enviar = async (pedidoId: string, tipo: "pedido_confirmado" | "entrega_concluida", mensagem: string) => {
    const agora = new Date().toISOString();
    db.prepare("INSERT INTO notificacoes (id, pedidoId, tipo, canal, enviadoEm) VALUES (?, ?, ?, 'console', ?)").run(
      randomUUID(),
      pedidoId,
      tipo,
      agora
    );
    console.log("[notificacoes] " + mensagem);
    await bus.publish(
      NotificacaoEnviada.parse({
        id: randomUUID(),
        tipo: "notificacao.enviada",
        ocorridoEm: agora,
        pedidoId,
        payload: { pedidoId, canal: "console", tipo },
      })
    );
  };

  const subscriptions = [
    bus.subscribe("pedido.confirmado", async (e) => {
      const evento = PedidoConfirmado.parse(e);
      await enviar(evento.pedidoId, "pedido_confirmado", "pedido " + evento.payload.numero + " confirmado — chega já já.");
    }),
    bus.subscribe("entrega.concluida", async (e) => {
      const evento = EntregaConcluida.parse(e);
      await enviar(evento.pedidoId, "entrega_concluida", "pedido entregue (recebido por " + evento.payload.recebidoPor + ").");
    }),
  ];

  return { app, port, subscriptions };
}
