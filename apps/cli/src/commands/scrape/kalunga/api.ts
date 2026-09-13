import type { HttpClient } from './client.js';
import { categoryFromDetails, parseDepartments, parseGroups, parseListingPage, parseProductPage, SITE, type ProductDetailsJson } from './parse.js';
import type { KalungaDepartment, KalungaGroup, ListedProduct, ListingPage, ScrapedProduct } from './types.js';

export type SortOrder = 'best-sellers' | 'name' | 'price-asc' | 'price-desc' | 'brand';
const SORT_CODE: Record<SortOrder, string> = { 'best-sellers': '1', name: '2', 'price-asc': '3', 'price-desc': '4', brand: '5' };

export async function fetchDepartments(client: HttpClient): Promise<KalungaDepartment[]> {
  return parseDepartments(await client.json<unknown>(`${SITE}/apimenu/submenuTodasCategorias`));
}

export async function fetchGroups(client: HttpClient, department: KalungaDepartment): Promise<KalungaGroup[]> {
  return parseGroups(await client.json<unknown>(`${SITE}/apimenu/submenu/${department.id}`));
}

export interface ListingQuery {
  departmentId: number;
  departmentSlug: string;
  /** 0 = todo o departamento. */
  groupId?: number;
  page?: number;
  sort?: SortOrder;
}

/** `POST /api/obterDepartamentoFiltros`: a mesma chamada que o site faz ao paginar. */
export async function fetchListingPage(client: HttpClient, query: ListingQuery): Promise<ListingPage> {
  const body = {
    codigo_menu: '0',
    codigo_classificacao: String(query.departmentId),
    codigo_grupo: query.groupId ?? 0,
    codigo_subgrupo: 0,
    filtro: 0,
    pageNumber: query.page ?? 1,
    tipoOrdenacao: SORT_CODE[query.sort ?? 'best-sellers'],
    departamento: query.departmentSlug,
  };
  const response = await client.json<{ templateProdutos?: string | null; templatePaginacao?: string | null }>(`${SITE}/api/obterDepartamentoFiltros`, {
    method: 'POST',
    headers: { 'content-type': 'application/json;charset=utf-8' },
    body: JSON.stringify(body),
  });
  return parseListingPage(response);
}

/** Página HTML + JSON de detalhes → produto completo. Campos ausentes caem no que a listagem já sabia. */
export async function fetchProduct(client: HttpClient, listed: ListedProduct): Promise<ScrapedProduct> {
  const [html, details] = await Promise.all([
    client.text(listed.url),
    client.json<ProductDetailsJson>(`${SITE}/api/obterProdutoDetalhes/${listed.id}`).catch(() => null),
  ]);
  const page = parseProductPage(html);
  const category = categoryFromDetails(details, page.categoryPath);
  const brand = page.brand ?? (details?.produto?.Fabricante ? { id: '', name: details.produto.Fabricante, slug: '', url: '' } : null);
  return {
    id: listed.id,
    slug: listed.slug,
    url: listed.url,
    name: page.name ?? details?.produto?.Descricao ?? listed.name,
    brand,
    category,
    price: {
      ...page.price,
      current: page.price.current ?? listed.price,
      list: page.price.list ?? listed.listPrice,
    },
    images: page.images.length > 0 ? page.images : listed.image ? [{ thumb: listed.image, large: null }] : [],
    description: page.description,
    rating: listed.rating,
    available: page.available,
    scrapedAt: new Date().toISOString(),
  };
}

/** Produto só com os dados da listagem (modo `--sem-detalhes`). */
export function productFromListing(listed: ListedProduct, department: KalungaDepartment, group: KalungaGroup | null): ScrapedProduct {
  return {
    id: listed.id,
    slug: listed.slug,
    url: listed.url,
    name: listed.name,
    brand: null,
    category: { department: department.name, group: group?.name ?? null, subgroup: null, path: [department.name, group?.name].filter(Boolean).join('/') },
    price: { current: listed.price, list: listed.listPrice, installments: null, currency: 'BRL' },
    images: listed.image ? [{ thumb: listed.image, large: null }] : [],
    description: null,
    rating: listed.rating,
    available: true,
    scrapedAt: new Date().toISOString(),
  };
}
