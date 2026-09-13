import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EventBusMemoria, type EventoDominio } from "@jaja/broker";
import { createService as criarCatalogo } from "@jaja/catalogo";
import { createService as criarPagamentos } from "@jaja/pagamentos";
import { createService as criarPedidos } from "./servico.js";

let bus: EventBusMemoria;
let catalogo: ReturnType<typeof criarCatalogo>;
let pedidos: ReturnType<typeof criarPedidos>;

const corpo = {
  bairro: "Aldeota",
  endereco: "Rua Frei Mansueto, 1000",
  andarSala: "sala 402",
  recebedor: "Ana",
  itens: [{ produtoId: "caneta-gel", quantidade: 2 }],
};

beforeAll(async () => {
  bus = new EventBusMemoria();
  catalogo = criarCatalogo({ dbPath: ":memory:" });
  await catalogo.app.listen({ port: 0, host: "127.0.0.1" });
  const endereco = catalogo.app.server.address() as { port: number };
  const catalogoUrl = "http://127.0.0.1:" + endereco.port;
  criarPagamentos({ bus, dbPath: ":memory:", atrasoMs: 10 });
  pedidos = criarPedidos({ bus, dbPath: ":memory:", catalogoUrl });
});

afterAll(async () => {
  await catalogo.app.close();
});

describe("fluxo pedido → pagamento", () => {
  it("POST /pedidos publica pedido.criado; pagamentos aprova; pedido vira 'pago'", async () => {
    const publicados: EventoDominio[] = [];
    bus.subscribe("pedido.criado", (e) => void publicados.push(e));
    bus.subscribe("pagamento.aprovado", (e) => void publicados.push(e));

    const res = await pedidos.app.inject({ method: "POST", url: "/pedidos", payload: corpo });
    expect(res.statusCode).toBe(201);
    const { pedidoId, numero } = res.json();
    expect(numero).toMatch(/^\d{4}$/);

    expect(publicados.map((e) => e.tipo)).toContain("pedido.criado");
    const criado = publicados.find((e) => e.tipo === "pedido.criado")!;
    // total recalculado no servidor: 2 × 490
    expect((criado.payload as { totalCentavos: number }).totalCentavos).toBe(980);

    // pagamentos consome, espera o atraso e publica pagamento.aprovado
    await new Promise((r) => setTimeout(r, 100));
    expect(publicados.map((e) => e.tipo)).toContain("pagamento.aprovado");

    const depois = await pedidos.app.inject({ url: "/pedidos/" + pedidoId });
    expect(depois.json().status).toBe("pago");
  });

  it("rejeita bairro não atendido com 409", async () => {
    const res = await pedidos.app.inject({
      method: "POST",
      url: "/pedidos",
      payload: { ...corpo, bairro: "Papicu" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().erro).toBe("bairro_nao_atendido");
  });

  it("rejeita sacola vazia com 400", async () => {
    const res = await pedidos.app.inject({
      method: "POST",
      url: "/pedidos",
      payload: { ...corpo, itens: [] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().erro).toBe("sacola_vazia");
  });
});
