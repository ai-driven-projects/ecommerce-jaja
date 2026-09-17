import { STOREFRONT_ROUTE } from '@/shared/navigation/storefront-routes';
import { withQuery } from '@/shared/navigation/with-query.util';
import { parsePage } from '@/shared/util/list-query.util';
import type { StorefrontProductFilter, StorefrontProductSort } from './storefront.api';
import { CATEGORY_ALL } from './storefront.types';

/**
 * Estado da vitrine na URL, com parâmetros em português: `bairro`, `categoria`
 * (slug; padrão `todas`), `q`, `marca` (slugs separados por vírgula),
 * `precoMin`/`precoMax` (reais, aceitando vírgula), `ofertas=1`, `destaques=1`,
 * `ordem` e `pagina`. Funções puras: ler, converter para o filtro da API e
 * montar links. Valores padrão ficam fora da URL.
 */

export const DEFAULT_NEIGHBORHOOD = 'Bela Vista';

export const STOREFRONT_ORDERS = ['relevancia', 'destaques', 'menor-preco', 'maior-preco', 'nome', 'desconto'] as const;

export type StorefrontOrder = (typeof STOREFRONT_ORDERS)[number];

const SORT_BY_ORDER: Readonly<Record<StorefrontOrder, StorefrontProductSort>> = {
  relevancia: 'relevance',
  destaques: 'featured',
  'menor-preco': 'price-asc',
  'maior-preco': 'price-desc',
  nome: 'name',
  desconto: 'discount',
};

/** No máximo 20 marcas, como a API. */
const MAX_BRANDS = 20;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type StorefrontParams = {
  /** `bairro` como veio na URL; `null` quando ausente (vale o padrão). */
  neighborhood: string | null;
  /** Slug da categoria; `todas` quando ausente. */
  category: string;
  /** Termo de busca já sem espaços nas pontas; `null` sem busca. */
  search: string | null;
  brands: string[];
  minPriceCents: number | null;
  maxPriceCents: number | null;
  onSale: boolean;
  featured: boolean;
  /** `null` usa a ordem padrão: relevância com busca, destaques sem. */
  order: StorefrontOrder | null;
  page: number;
};

export type StorefrontParamChanges = Partial<StorefrontParams>;

export const EMPTY_STOREFRONT_PARAMS: StorefrontParams = {
  neighborhood: null,
  category: CATEGORY_ALL,
  search: null,
  brands: [],
  minPriceCents: null,
  maxPriceCents: null,
  onSale: false,
  featured: false,
  order: null,
  page: 1,
};

type SearchParamsReader = { get(name: string): string | null };

/**
 * Texto em reais → centavos inteiros. Aceita `12,90`, `12.90`, `1.290,90` e
 * `300`; vazio, negativo ou com mais de duas casas vira `null`.
 */
export function parseReaisToCents(text: string | null | undefined): number | null {
  const normalized = (text ?? '').replace(/\s/g, '').replace(/^R\$/i, '');
  if (normalized === '') return null;

  const decimal = normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized;
  if (!/^\d+(\.\d{1,2})?$/.test(decimal)) return null;

  const cents = Math.round(Number(decimal) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Centavos → reais para a URL e os campos: `30000` → `300`, `1290` → `12,90`. */
export function formatCentsAsReais(cents: number): string {
  const reais = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest === 0 ? String(reais) : `${reais},${String(rest).padStart(2, '0')}`;
}

function parseOrder(value: string | null, search: string | null): StorefrontOrder | null {
  const order = STOREFRONT_ORDERS.find((option) => option === value) ?? null;
  // "Mais relevantes" só existe com busca.
  if (order === 'relevancia' && !search) return null;
  return order;
}

function parseBrands(value: string | null): string[] {
  const slugs = (value ?? '')
    .split(',')
    .map((slug) => slug.trim())
    .filter((slug) => SLUG_PATTERN.test(slug));
  return [...new Set(slugs)].slice(0, MAX_BRANDS);
}

/** Lê a URL da vitrine descartando valores inválidos. */
export function parseStorefrontParams(searchParams: SearchParamsReader): StorefrontParams {
  const neighborhood = searchParams.get('bairro')?.trim() || null;
  const category = searchParams.get('categoria')?.trim() || CATEGORY_ALL;
  const search = searchParams.get('q')?.trim() || null;

  return {
    neighborhood,
    category,
    search,
    brands: parseBrands(searchParams.get('marca')),
    minPriceCents: parseReaisToCents(searchParams.get('precoMin')),
    maxPriceCents: parseReaisToCents(searchParams.get('precoMax')),
    onSale: searchParams.get('ofertas') === '1',
    featured: searchParams.get('destaques') === '1',
    order: parseOrder(searchParams.get('ordem'), search),
    page: parsePage(searchParams.get('pagina')),
  };
}

/** Marca, preço, só ofertas ou só destaques (busca, categoria e ordem não contam). */
export function hasCatalogFilters(params: StorefrontParams): boolean {
  return (
    params.brands.length > 0 ||
    params.minPriceCents !== null ||
    params.maxPriceCents !== null ||
    params.onSale ||
    params.featured
  );
}

/** Página inicial: sem busca, sem filtros e com a categoria `todas`. */
export function isStorefrontHome(params: StorefrontParams): boolean {
  return !params.search && !hasCatalogFilters(params) && params.category === CATEGORY_ALL;
}

/** Ordem efetiva: a escolhida ou a padrão para a busca atual. */
export function effectiveOrder(params: StorefrontParams): StorefrontOrder {
  return params.order ?? (params.search ? 'relevancia' : 'destaques');
}

/** Filtro da API: reais já em centavos, `ordem` em `sort` e só os filtros definidos. */
export function toStorefrontProductFilter(params: StorefrontParams, pageSize: number): StorefrontProductFilter {
  const filter: StorefrontProductFilter = { page: params.page, pageSize };

  if (params.search) filter.search = params.search;
  if (params.category !== CATEGORY_ALL) filter.categorySlug = params.category;
  if (params.brands.length > 0) filter.brandSlugs = params.brands;
  if (params.minPriceCents !== null) filter.minPriceCents = params.minPriceCents;
  if (params.maxPriceCents !== null) filter.maxPriceCents = params.maxPriceCents;
  if (params.onSale) filter.onSale = true;
  if (params.featured) filter.featured = true;
  if (params.order) filter.sort = SORT_BY_ORDER[params.order];

  return filter;
}

/**
 * Aplica as mudanças: trocar qualquer coisa além de `bairro` e `pagina` volta à
 * página 1, e `relevancia` sem busca vira a ordem padrão.
 */
export function applyStorefrontChanges(params: StorefrontParams, changes: StorefrontParamChanges): StorefrontParams {
  const resetsPage = Object.keys(changes).some((key) => key !== 'neighborhood' && key !== 'page');
  const next: StorefrontParams = { ...params, ...(resetsPage ? { page: 1 } : {}), ...changes };
  next.search = next.search?.trim() || null;
  if (next.order === 'relevancia' && !next.search) next.order = null;
  return next;
}

/**
 * Query string (sem `?`) na ordem canônica, sem valores padrão. Na página
 * inicial `ordem` e `pagina` não têm efeito e também saem.
 */
export function buildStorefrontQuery(params: StorefrontParams): string {
  const query = new URLSearchParams();
  const home = isStorefrontHome(params);

  if (params.neighborhood) query.set('bairro', params.neighborhood);
  if (params.category !== CATEGORY_ALL) query.set('categoria', params.category);
  if (params.search) query.set('q', params.search);
  if (params.brands.length > 0) query.set('marca', params.brands.join(','));
  if (params.minPriceCents !== null) query.set('precoMin', formatCentsAsReais(params.minPriceCents));
  if (params.maxPriceCents !== null) query.set('precoMax', formatCentsAsReais(params.maxPriceCents));
  if (params.onSale) query.set('ofertas', '1');
  if (params.featured) query.set('destaques', '1');
  if (!home && params.order && params.order !== effectiveOrder({ ...params, order: null })) query.set('ordem', params.order);
  if (!home && params.page > 1) query.set('pagina', String(params.page));

  // Vírgula é válida na query string: `marca=hp,canon` e `precoMin=12,90` ficam legíveis.
  return query.toString().replace(/%2C/gi, ',');
}

/** Link da vitrine (`/`) com as mudanças aplicadas ao estado atual. */
export function buildStorefrontHref(params: StorefrontParams, changes: StorefrontParamChanges = {}): string {
  return withQuery(STOREFRONT_ROUTE, buildStorefrontQuery(applyStorefrontChanges(params, changes)));
}

/** Só o bairro atual: base dos links que recomeçam a navegação (busca, seções, trilha). */
export function storefrontBaseParams(params: StorefrontParams): StorefrontParams {
  return { ...EMPTY_STOREFRONT_PARAMS, neighborhood: params.neighborhood };
}
