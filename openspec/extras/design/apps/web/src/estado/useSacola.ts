import { useSyncExternalStore } from "react";
import {
  adicionarItem,
  alterarQuantidadeItem,
  ItemSacola,
  NovoItem,
  quantidadeTotal,
  removerItem,
  totalCentavos,
} from "./sacola";

const CHAVE = "jaja.sacola";

let itens: ItemSacola[] = (() => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as ItemSacola[];
  } catch {
    return [];
  }
})();

const ouvintes = new Set<() => void>();

function definir(novos: ItemSacola[]) {
  itens = novos;
  localStorage.setItem(CHAVE, JSON.stringify(itens));
  ouvintes.forEach((f) => f());
}

/** Estado global da sacola, persistido em localStorage (painel vem no prompt 3). */
export function useSacola() {
  const atual = useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => itens
  );
  return {
    itens: atual,
    quantidadeTotal: quantidadeTotal(atual),
    total: totalCentavos(atual),
    adicionar: (item: NovoItem, quantidade = 1) => definir(adicionarItem(itens, item, quantidade)),
    remover: (produtoId: string) => definir(removerItem(itens, produtoId)),
    alterarQuantidade: (produtoId: string, quantidade: number) =>
      definir(alterarQuantidadeItem(itens, produtoId, quantidade)),
    esvaziar: () => definir([]),
  };
}
