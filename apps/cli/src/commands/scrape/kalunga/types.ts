/** Departamento da Kalunga (categoria principal do site). */
export interface KalungaDepartment {
  /** `Classificacao` no site; é o código usado nas URLs `/depto/<slug>/<id>` e na listagem. */
  id: number;
  /** Id do item de menu (`Id`), usado só para referência. */
  menuId: number;
  slug: string;
  name: string;
  shortName: string;
  url: string;
  order: number;
}

/** Grupo (subcategoria) listado no menu de um departamento. */
export interface KalungaGroup {
  /** `Codigo` do grupo; é o `codigo_grupo` da listagem. */
  id: number;
  /** Departamento a que o grupo pertence de fato (pode diferir do menu onde aparece). */
  departmentId: number;
  departmentSlug: string;
  slug: string;
  name: string;
  url: string;
  /** Aparece em destaque no menu do departamento. */
  highlighted: boolean;
}

/** Produto como aparece num card de listagem. */
export interface ListedProduct {
  id: string;
  slug: string;
  url: string;
  name: string;
  image: string | null;
  price: number | null;
  listPrice: number | null;
  rating: { stars: number; count: number } | null;
}

export interface ListingPage {
  products: ListedProduct[];
  /** Total de produtos informado pela paginação (`null` quando o site não informa). */
  total: number | null;
  pageSize: number;
  pages: number;
}

export interface ProductBrand {
  /** CNPJ do fornecedor, como o site identifica a marca. */
  id: string;
  name: string;
  slug: string;
  url: string;
}

export interface ProductImage {
  /** Miniatura/normal (`<id>d.jpg`). */
  thumb: string;
  /** Zoom (`<id>z.jpg`), quando existe. */
  large: string | null;
}

export interface ProductPrice {
  /** Preço à vista (ou o único preço exibido). */
  current: number | null;
  /** Preço "De:" quando há desconto. */
  list: number | null;
  installments: { count: number; amount: number; total: number | null } | null;
  currency: 'BRL';
}

export interface ScrapedProduct {
  id: string;
  slug: string;
  url: string;
  name: string;
  brand: ProductBrand | null;
  category: {
    department: string;
    group: string | null;
    subgroup: string | null;
    /** Caminho como o site classifica: "Escolar/Borrachas/Borrachas Técnicas". */
    path: string;
  };
  price: ProductPrice;
  images: ProductImage[];
  description: { html: string; text: string } | null;
  rating: { stars: number; count: number } | null;
  available: boolean;
  scrapedAt: string;
}

/** Arquivo `categories/<slug>.json`. */
export interface CategoryFile {
  source: 'kalunga';
  scrapedAt: string;
  category: KalungaDepartment & { groups: KalungaGroup[] };
  /** Como os produtos foram escolhidos. */
  sampling: { requested: string; target: number; groupsSampled: number; perGroup: number };
  products: ScrapedProduct[];
}

export interface BrandEntry extends ProductBrand {
  products: number;
  categories: string[];
}

/** Arquivo `brands.json`, consolidado de todas as categorias raspadas. */
export interface BrandsFile {
  source: 'kalunga';
  scrapedAt: string;
  brands: BrandEntry[];
}

/** Arquivo `index.json`: resumo do que existe em `data/kalunga`. */
export interface IndexFile {
  source: 'kalunga';
  scrapedAt: string;
  categories: Array<{ id: number; slug: string; name: string; file: string; products: number; scrapedAt: string }>;
  brands: number;
}
