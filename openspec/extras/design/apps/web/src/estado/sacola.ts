// Funções puras da sacola — testáveis sem DOM/localStorage.

export type ItemSacola = {
  produtoId: string;
  slug: string;
  nome: string;
  precoCentavos: number;
  quantidade: number;
};

export type NovoItem = Omit<ItemSacola, "quantidade">;

export function adicionarItem(itens: ItemSacola[], novo: NovoItem, quantidade = 1): ItemSacola[] {
  const existente = itens.find((i) => i.produtoId === novo.produtoId);
  if (!existente) return [...itens, { ...novo, quantidade }];
  return itens.map((i) =>
    i.produtoId === novo.produtoId ? { ...i, quantidade: i.quantidade + quantidade } : i
  );
}

export function removerItem(itens: ItemSacola[], produtoId: string): ItemSacola[] {
  return itens.filter((i) => i.produtoId !== produtoId);
}

export function alterarQuantidadeItem(
  itens: ItemSacola[],
  produtoId: string,
  quantidade: number
): ItemSacola[] {
  if (quantidade <= 0) return removerItem(itens, produtoId);
  return itens.map((i) => (i.produtoId === produtoId ? { ...i, quantidade } : i));
}

export function totalCentavos(itens: ItemSacola[]): number {
  return itens.reduce((soma, i) => soma + i.precoCentavos * i.quantidade, 0);
}

export function quantidadeTotal(itens: ItemSacola[]): number {
  return itens.reduce((soma, i) => soma + i.quantidade, 0);
}
