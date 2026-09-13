import { describe, expect, it } from "vitest";
import { PagamentoAprovado, PedidoCriado } from "./index";

const valido = {
  id: "0b7f2f2e-9a3d-4a56-8b1f-2c3d4e5f6a7b",
  tipo: "pedido.criado" as const,
  ocorridoEm: "2026-09-08T12:00:00.000Z",
  pedidoId: "1c8e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6",
  payload: {
    pedidoId: "1c8e3f4a-5b6c-4d7e-8f90-a1b2c3d4e5f6",
    numero: "0427",
    bairro: "Aldeota",
    hub: "Hub Aldeota",
    itens: [{ produtoId: "caneta-gel", nome: "Caneta gel preta", precoCentavos: 490, quantidade: 2 }],
    totalCentavos: 980,
  },
};

describe("PedidoCriado", () => {
  it("aceita um evento válido", () => {
    expect(PedidoCriado.parse(valido)).toEqual(valido);
  });

  it("rejeita comando/tipo errado, itens vazios e numero fora do formato", () => {
    expect(PedidoCriado.safeParse({ ...valido, tipo: "pedido.criar" }).success).toBe(false);
    expect(
      PedidoCriado.safeParse({ ...valido, payload: { ...valido.payload, itens: [] } }).success
    ).toBe(false);
    expect(
      PedidoCriado.safeParse({ ...valido, payload: { ...valido.payload, numero: "42" } }).success
    ).toBe(false);
  });
});

describe("PagamentoAprovado", () => {
  it("aceita pix e rejeita outros meios", () => {
    const evento = {
      id: valido.id,
      tipo: "pagamento.aprovado" as const,
      ocorridoEm: valido.ocorridoEm,
      pedidoId: valido.pedidoId,
      payload: { pedidoId: valido.pedidoId, meio: "pix" as const, valorCentavos: 980 },
    };
    expect(PagamentoAprovado.parse(evento)).toEqual(evento);
    expect(
      PagamentoAprovado.safeParse({ ...evento, payload: { ...evento.payload, meio: "boleto" } }).success
    ).toBe(false);
  });
});
