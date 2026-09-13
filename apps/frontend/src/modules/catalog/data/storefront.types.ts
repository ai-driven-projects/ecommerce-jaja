/**
 * Tipos do catálogo local da vitrine. Quando a API existir, o hook troca a
 * origem dos dados e os componentes da loja não mudam.
 */

export const CATEGORY_ALL = 'todas';

export type ProductCategory =
  | 'papelaria'
  | 'impressão'
  | 'café e lanches'
  | 'limpeza de escritório'
  | 'tecnologia básica';

/** Filtro da vitrine: `todas` ou uma categoria de produto. */
export type Category = typeof CATEGORY_ALL | ProductCategory;

/** Seção de destaque da home em que o produto aparece. */
export type ProductHighlight = 'top' | 'restock';

export type Product = {
  /** Identificador de URL, único no catálogo. */
  slug: string;
  name: string;
  category: ProductCategory;
  priceCents: number;
  /** Preço anterior, quando em oferta (aparece riscado e o produto entra em "Ofertas da semana"). */
  oldPriceCents?: number;
  /** Unidade de venda: "Resma 500 folhas · 75g", "Caixa com 12 un", ... */
  unit: string;
  /** Emoji que representa o produto na área de imagem. */
  emoji: string;
  highlight?: ProductHighlight;
  /** Descrição curta para a página de detalhe. */
  description: string;
  /** Ficha técnica em pares rótulo/valor. */
  specs: ReadonlyArray<readonly [string, string]>;
  /** Unidades em estoque no hub (dado local de exemplo). */
  stock: number;
};

export type Zone = {
  neighborhood: string;
  hub: string;
};
