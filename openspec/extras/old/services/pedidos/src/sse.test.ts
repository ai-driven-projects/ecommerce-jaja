import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { EventBusMemoria } from "@jaja/broker";
import { createService as criarCatalogo } from "@jaja/catalogo";
import { createService as criarPedidos } from "./servico.js";

let bus: EventBusMemoria;
let catalogo: ReturnType<typeof criarCatalogo>;
let pedidos: ReturnType<typeof criarPedidos>;
let baseUrl: string;

beforeAll(async () => {
  bus = new EventBusMemoria();
  catalogo = criarCatalogo({ dbPath: ":memory:" });
  await catalogo.app.listen({ port: 0, host: "127.0.0.1" });
  const pc = catalogo.app.server.address() as { port: number };
  pedidos = criarPedidos({ bus, dbPath: ":memory:", catalogoUrl: "http://127.0.0.1:" + pc.port });
  await pedidos.app.listen({ port: 0, host: "127.0.0.1" });
  baseUrl = "http://127.0.0.1:" + (pedidos.app.server.address() as { port: number }).port;
});

afterAll(async () => {
  await pedidos.app.close();
  await catalogo.app.close();
});

describe("GET /pedidos/:id/stream (SSE)", () => {
  it("envia o histórico na conexão e depois eventos ao vivo, com id = eventoId", async () => {
    const criar = await fetch(baseUrl + "/pedidos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bairro: "Centro",
        endereco: "Rua Major Facundo, 500",
        recebedor: "Bruno",
        itens: [{ produtoId: "agua-mineral", quantidade: 1 }],
      }),
    });
    const { pedidoId } = (await criar.json()) as { pedidoId: string };

    const resposta = await fetch(baseUrl + "/pedidos/" + pedidoId + "/stream");
    expect(resposta.headers.get("content-type")).toContain("text/event-stream");
    const reader = resposta.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const lerAte = async (trecho: string) => {
      const limite = Date.now() + 3000;
      while (!buffer.includes(trecho) && Date.now() < limite) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value);
      }
      expect(buffer).toContain(trecho);
    };

    // histórico inteiro chega na conexão
    await lerAte("pedido.criado");
    expect(buffer).toMatch(/id: [0-9a-f-]{36}/);

    // evento novo chega ao vivo
    await bus.publish({
      id: randomUUID(),
      tipo: "pagamento.aprovado",
      ocorridoEm: new Date().toISOString(),
      pedidoId,
      payload: { pedidoId, meio: "pix", valorCentavos: 350 },
    });
    await lerAte("pagamento.aprovado");
    await reader.cancel();
  });
});
