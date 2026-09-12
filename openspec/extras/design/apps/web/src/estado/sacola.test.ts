import { describe, expect, it } from "vitest";
import { adicionarItem, alterarQuantidadeItem, removerItem, totalCentavos } from "./sacola";

const caneta = { produtoId: "caneta-gel", slug: "caneta-gel", nome: "Caneta gel preta", precoCentavos: 490 };

describe("sacola", () => {
  it("soma quantidades ao adicionar o mesmo produto duas vezes", () => {
    let itens = adicionarItem([], caneta, 1);
    itens = adicionarItem(itens, caneta, 2);
    expect(itens).toHaveLength(1);
    expect(itens[0].quantidade).toBe(3);
    expect(totalCentavos(itens)).toBe(1470);
  });

  it("remove quando a quantidade chega a zero", () => {
    let itens = adicionarItem([], caneta, 2);
    itens = alterarQuantidadeItem(itens, "caneta-gel", 0);
    expect(itens).toHaveLength(0);
  });

  it("remover tira só o produto pedido", () => {
    let itens = adicionarItem([], caneta, 1);
    itens = adicionarItem(itens, { ...caneta, produtoId: "pilhas-aa", slug: "pilhas-aa" }, 1);
    itens = removerItem(itens, "caneta-gel");
    expect(itens.map((i) => i.produtoId)).toEqual(["pilhas-aa"]);
  });
});
