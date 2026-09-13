import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import type { EventBus } from "@jaja/broker";
import {
  EntregaACaminho,
  EntregaAtribuida,
  EntregaChegando,
  EntregaConcluida,
  EstoqueSeparado,
  PedidoConfirmado,
} from "@jaja/contratos";
import { abrirBanco } from "./banco.js";

// Todos os atrasos simulados leem JAJA_ESCALA_TEMPO (padrão 1; ver CLAUDE.md).
const ESCALA = Number(process.env.JAJA_ESCALA_TEMPO ?? "1") || 1;

type Entregador = { id: string; nome: string; modal: "bike" | "a pé"; hub: string };
type Entrega = {
  pedidoId: string;
  hub: string;
  entregadorId: string | null;
  atribuida: number;
  separada: number;
  aCaminho: number;
};

export function createService({
  bus,
  dbPath,
  port = 3005,
  atrasos = {},
}: {
  bus: EventBus;
  dbPath?: string;
  port?: number;
  atrasos?: { atribuicaoMs?: number; chegandoMs?: number; conclusaoMs?: number };
}) {
  const db = abrirBanco(dbPath);
  const app = Fastify();
  app.register(cors, { origin: true });
  app.get("/saude", async () => ({ ok: true }));

  const atribuicaoMs = (atrasos.atribuicaoMs ?? 2000) * ESCALA;
  const chegandoMs = (atrasos.chegandoMs ?? 8000) * ESCALA;
  const conclusaoMs = (atrasos.conclusaoMs ?? 5000) * ESCALA;

  const publicar = async (tipo: string, pedidoId: string, payload: unknown, schema: { parse: (v: unknown) => unknown }) =>
    bus.publish(
      schema.parse({
        id: randomUUID(),
        tipo,
        ocorridoEm: new Date().toISOString(),
        pedidoId,
        payload,
      }) as never
    );

  const garantirEntrega = (pedidoId: string, hub: string) =>
    db.prepare("INSERT OR IGNORE INTO entregas (pedidoId, hub) VALUES (?, ?)").run(pedidoId, hub);

  // Coordenação por eventos (primeiro exemplo do curso): só publica
  // entrega.a_caminho quando os DOIS fatos chegaram — entrega.atribuida e
  // estoque.separado — em qualquer ordem. O estado parcial vive no banco.
  const verificarACaminho = async (pedidoId: string) => {
    const entrega = db.prepare("SELECT * FROM entregas WHERE pedidoId = ?").get(pedidoId) as Entrega | undefined;
    if (!entrega || !entrega.atribuida || !entrega.separada || entrega.aCaminho) return;
    db.prepare("UPDATE entregas SET aCaminho = 1 WHERE pedidoId = ?").run(pedidoId);
    await publicar("entrega.a_caminho", pedidoId, { pedidoId }, EntregaACaminho);
    setTimeout(async () => {
      await publicar("entrega.chegando", pedidoId, { pedidoId, distanciaMetros: 350 }, EntregaChegando);
      setTimeout(async () => {
        await publicar("entrega.concluida", pedidoId, { pedidoId, recebidoPor: "recepção" }, EntregaConcluida);
        db.prepare("UPDATE entregas SET concluidaEm = ? WHERE pedidoId = ?").run(new Date().toISOString(), pedidoId);
        if (entrega.entregadorId)
          db.prepare("UPDATE entregadores SET livre = 1 WHERE id = ?").run(entrega.entregadorId);
      }, conclusaoMs);
    }, chegandoMs);
  };

  const subscriptions = [
    bus.subscribe("pedido.confirmado", (e) => {
      const evento = PedidoConfirmado.parse(e);
      garantirEntrega(evento.pedidoId, evento.payload.hub);
      setTimeout(async () => {
        const livre = (db
          .prepare("SELECT * FROM entregadores WHERE hub = ? AND livre = 1 ORDER BY id LIMIT 1")
          .get(evento.payload.hub) ??
          db.prepare("SELECT * FROM entregadores WHERE livre = 1 ORDER BY id LIMIT 1").get()) as
          | Entregador
          | undefined;
        if (!livre) {
          // entrega.sem_entregador entra no prompt 6.
          console.log("[entregas] ninguém livre para o pedido " + evento.pedidoId);
          return;
        }
        db.prepare("UPDATE entregadores SET livre = 0 WHERE id = ?").run(livre.id);
        db.prepare("UPDATE entregas SET entregadorId = ?, atribuida = 1 WHERE pedidoId = ?").run(
          livre.id,
          evento.pedidoId
        );
        await publicar(
          "entrega.atribuida",
          evento.pedidoId,
          { pedidoId: evento.pedidoId, entregador: { nome: livre.nome, modal: livre.modal }, hub: evento.payload.hub },
          EntregaAtribuida
        );
        await verificarACaminho(evento.pedidoId);
      }, atribuicaoMs);
    }),

    bus.subscribe("estoque.separado", async (e) => {
      const evento = EstoqueSeparado.parse(e);
      garantirEntrega(evento.pedidoId, evento.payload.hub);
      db.prepare("UPDATE entregas SET separada = 1 WHERE pedidoId = ?").run(evento.pedidoId);
      await verificarACaminho(evento.pedidoId);
    }),
  ];

  return { app, port, subscriptions };
}
