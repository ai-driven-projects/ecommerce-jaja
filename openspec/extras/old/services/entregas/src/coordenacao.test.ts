import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { EventBusMemoria } from "@jaja/broker";
import { createService as criarEntregas } from "./servico.js";

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

const confirmado = (pedidoId: string) => ({
  id: randomUUID(),
  tipo: "pedido.confirmado",
  ocorridoEm: new Date().toISOString(),
  pedidoId,
  payload: {
    pedidoId,
    numero: "0001",
    bairro: "Aldeota",
    hub: "Hub Aldeota",
    itens: [{ produtoId: "caneta-gel", nome: "Caneta gel preta", precoCentavos: 490, quantidade: 1 }],
    previsaoEntrega: new Date(Date.now() + 14 * 60000).toISOString(),
  },
});

const separado = (pedidoId: string) => ({
  id: randomUUID(),
  tipo: "estoque.separado",
  ocorridoEm: new Date().toISOString(),
  pedidoId,
  payload: { pedidoId, hub: "Hub Aldeota" },
});

const montar = () => {
  const bus = new EventBusMemoria();
  criarEntregas({ bus, dbPath: ":memory:", atrasos: { atribuicaoMs: 5, chegandoMs: 5, conclusaoMs: 5 } });
  const tipos: string[] = [];
  for (const t of ["entrega.atribuida", "entrega.a_caminho", "entrega.chegando", "entrega.concluida"])
    bus.subscribe(t, (e) => void tipos.push(e.tipo));
  return { bus, tipos };
};

describe("coordenação atribuida + separado → a_caminho", () => {
  it("não publica a_caminho só com a atribuição; sai quando o separado chega", async () => {
    const { bus, tipos } = montar();
    const pedidoId = randomUUID();
    await bus.publish(confirmado(pedidoId));
    await espera(40);
    expect(tipos).toContain("entrega.atribuida");
    expect(tipos).not.toContain("entrega.a_caminho");

    await bus.publish(separado(pedidoId));
    await espera(60);
    expect(tipos).toContain("entrega.a_caminho");
    expect(tipos).toContain("entrega.chegando");
    expect(tipos).toContain("entrega.concluida");
  });

  it("ordem inversa: separado antes da atribuição também segura o a_caminho", async () => {
    const { bus, tipos } = montar();
    const pedidoId = randomUUID();
    await bus.publish(separado(pedidoId));
    await espera(40);
    expect(tipos).not.toContain("entrega.a_caminho");

    await bus.publish(confirmado(pedidoId));
    await espera(80);
    expect(tipos).toContain("entrega.atribuida");
    expect(tipos).toContain("entrega.a_caminho");
  });
});
