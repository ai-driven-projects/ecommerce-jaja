import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { EventBusMemoria } from "@jaja/broker";
import { createService as criarCatalogo } from "@jaja/catalogo";
import { createService as criarPedidos } from "./servico.js";

let bus: EventBusMemoria;
let catalogo: ReturnType<typeof criarCatalogo>;
let pedidos: ReturnType<typeof criarPedidos>;
let pedidoId: string;

const evento = (tipo: string, payload: Record<string, unknown> = {}, id = randomUUID()) => ({
  id,
  tipo,
  ocorridoEm: new Date().toISOString(),
  pedidoId,
  payload: { pedidoId, ...payload },
});

beforeAll(async () => {
  bus = new EventBusMemoria();
  catalogo = criarCatalogo({ dbPath: ":memory:" });
  await catalogo.app.listen({ port: 0, host: "127.0.0.1" });
  const { port } = catalogo.app.server.address() as { port: number };
  pedidos = criarPedidos({ bus, dbPath: ":memory:", catalogoUrl: "http://127.0.0.1:" + port });
  const res = await pedidos.app.inject({
    method: "POST",
    url: "/pedidos",
    payload: {
      bairro: "Aldeota",
      endereco: "Av. Santos Dumont, 1500",
      andarSala: "12º andar",
      recebedor: "Ana",
      itens: [{ produtoId: "caneta-gel", quantidade: 2 }],
    },
  });
  pedidoId = res.json().pedidoId;
});

afterAll(async () => {
  await catalogo.app.close();
});

describe("máquina de estados do pedido", () => {
  it("ignora evento fora de ordem (chegando com pedido ainda 'criado')", async () => {
    await bus.publish(evento("entrega.chegando", { distanciaMetros: 100 }));
    const r = await pedidos.app.inject({ url: "/pedidos/" + pedidoId });
    expect(r.json().status).toBe("criado");
    const eventos = (await pedidos.app.inject({ url: "/pedidos/" + pedidoId + "/eventos" })).json();
    expect(eventos.map((e: { tipo: string }) => e.tipo)).toEqual(["pedido.criado"]);
  });

  it("aplica a transição e deduplica evento repetido pelo eventoId", async () => {
    const aprovado = evento("pagamento.aprovado", { meio: "pix", valorCentavos: 980 });
    await bus.publish(aprovado);
    await bus.publish(aprovado); // mesmo eventoId, chega de novo
    const r = await pedidos.app.inject({ url: "/pedidos/" + pedidoId });
    expect(r.json().status).toBe("pago");
    const eventos = (await pedidos.app.inject({ url: "/pedidos/" + pedidoId + "/eventos" })).json();
    expect(eventos.filter((e: { tipo: string }) => e.tipo === "pagamento.aprovado")).toHaveLength(1);
  });

  it("estoque.reservado confirma o pedido e publica pedido.confirmado", async () => {
    const confirmados: unknown[] = [];
    bus.subscribe("pedido.confirmado", (e) => void confirmados.push(e));
    await bus.publish(evento("estoque.reservado", { hub: "Hub Aldeota", itens: [{ produtoId: "caneta-gel", quantidade: 2 }] }));
    const r = await pedidos.app.inject({ url: "/pedidos/" + pedidoId });
    expect(r.json().status).toBe("confirmado");
    expect(confirmados).toHaveLength(1);
  });
});
