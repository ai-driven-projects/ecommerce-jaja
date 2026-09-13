import type { KalungaDepartment, KalungaGroup, ListedProduct, ListingPage, ProductBrand, ProductImage, ProductPrice } from './types.js';

export const SITE = 'https://www.kalunga.com.br';

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä', eacute: 'é', egrave: 'è', ecirc: 'ê', iacute: 'í', oacute: 'ó', ocirc: 'ô', otilde: 'õ', uacute: 'ú', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ',
  ordm: 'º', ordf: 'ª', deg: '°', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', copy: '©', reg: '®', trade: '™', euro: '€', times: '×', middot: '·',
};
const UPPER_ENTITIES = new Set(['aacute', 'agrave', 'acirc', 'atilde', 'auml', 'eacute', 'egrave', 'ecirc', 'iacute', 'oacute', 'ocirc', 'otilde', 'uacute', 'uuml', 'ccedil', 'ntilde']);

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    const lower = code.toLowerCase();
    if (lower in ENTITIES) {
      const value = ENTITIES[lower] as string;
      return code !== lower && UPPER_ENTITIES.has(lower) ? value.toUpperCase() : value;
    }
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10));
    return match;
  });
}

/** Remove tags e normaliza espaços. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|div|li|h[1-6]|tr|ul|ol)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Mantém só a marcação de conteúdo da descrição (sem scripts, estilos e atributos de evento/estilo). */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\s(on[a-z]+|style|class|id)="[^"]*"/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "R$ 1.039,51" → 1039.51 */
export function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.replace(/\s/g, '').match(/(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/);
  if (!match) return null;
  return Number(`${(match[1] as string).replace(/\./g, '')}.${match[2]}`);
}

export function slugFromUrl(url: string): string {
  const match = url.match(/\/depto\/(?:[a-z0-9-]+\/)*([a-z0-9-]+)\/\d+(?:\/\d+)*\/?(?:\?|$)/i) ?? url.match(/\/prod\/([a-z0-9-]+)\/\d+/i);
  return match ? (match[1] as string) : '';
}

interface MenuItemJson {
  Classificacao: number;
  Descricao: string;
  DescricaoShort?: string;
  Id: number;
  LinkMenu: string;
  Ordem?: number;
}

/** `GET /apimenu/submenuTodasCategorias` → departamentos, na ordem do menu. */
export function parseDepartments(json: unknown): KalungaDepartment[] {
  if (!Array.isArray(json)) return [];
  // Só departamentos de verdade (`/depto/<slug>/<id>`); o menu também traz atalhos como /outlet.
  return (json as MenuItemJson[])
    .filter((item) => typeof item.Classificacao === 'number' && typeof item.LinkMenu === 'string' && /\/depto\/[a-z0-9-]+\/\d+\/?$/i.test(item.LinkMenu))
    .map((item) => ({
      id: item.Classificacao,
      menuId: item.Id,
      slug: slugFromUrl(item.LinkMenu) || String(item.Classificacao),
      name: decodeEntities(item.Descricao ?? '').trim(),
      shortName: decodeEntities(item.DescricaoShort ?? item.Descricao ?? '').trim(),
      url: item.LinkMenu,
      order: item.Ordem ?? 0,
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

interface SubMenuItemJson {
  Classificacao: number;
  Codigo: number;
  FL_Destaque?: boolean;
  LinkSubMenu: string;
  Texto: string;
}

/** `GET /apimenu/submenu/<classificacao>` → grupos do departamento (sem repetições). */
export function parseGroups(json: unknown): KalungaGroup[] {
  const root = json as { menu?: SubMenuItemJson[]; menu_destaque?: SubMenuItemJson[] } | null;
  const items = [...(root?.menu ?? []), ...(root?.menu_destaque ?? [])];
  const byId = new Map<number, KalungaGroup>();
  for (const item of items) {
    if (typeof item.Codigo !== 'number' || typeof item.LinkSubMenu !== 'string') continue;
    const match = item.LinkSubMenu.match(/\/depto\/([a-z0-9-]+)\/([a-z0-9-]+)\/(\d+)\/(\d+)/i);
    if (!match) continue;
    const existing = byId.get(item.Codigo);
    const group: KalungaGroup = {
      id: item.Codigo,
      departmentId: Number(match[3]),
      departmentSlug: match[1] as string,
      slug: match[2] as string,
      name: decodeEntities(item.Texto ?? '').trim(),
      url: item.LinkSubMenu,
      highlighted: item.FL_Destaque === true || existing?.highlighted === true,
    };
    byId.set(item.Codigo, group);
  }
  return [...byId.values()];
}

/** `montarPaginacao(this, 552, 60, ...)` e os `data-page` → total, tamanho e número de páginas. */
export function parsePagination(template: string | null | undefined): { total: number | null; pageSize: number; pages: number } {
  const html = template ?? '';
  const match = html.match(/montarPaginacao\(\s*this\s*,\s*(\d+)\s*,\s*(\d+)/);
  const pageNumbers = [...html.matchAll(/data-page=['"](\d+)['"]/g)].map((entry) => Number(entry[1]));
  const lastPage = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
  if (match) {
    const total = Number(match[1]);
    const pageSize = Number(match[2]) || 60;
    return { total, pageSize, pages: Math.max(lastPage, Math.ceil(total / pageSize)) };
  }
  return { total: null, pageSize: 60, pages: lastPage };
}

function parseStars(card: string): { stars: number; count: number } | null {
  const count = card.match(/reviews__star_text[^>]*>\s*\((\d+)\)/);
  if (!count || Number(count[1]) === 0) return null;
  const full = (card.match(/fa-star text-warning/g) ?? []).length;
  const half = (card.match(/fa-star-half/g) ?? []).length;
  return { stars: full + half * 0.5, count: Number(count[1]) };
}

/** Cards `.blocoproduto` do `templateProdutos` → produtos da página. */
export function parseListing(template: string | null | undefined): ListedProduct[] {
  const html = template ?? '';
  const cards = html.split(/<div class="blocoproduto\s/).slice(1);
  const products: ListedProduct[] = [];
  const seen = new Set<string>();
  for (const card of cards) {
    const link = card.match(/href="(\/prod\/([a-z0-9-]+)\/(\d+))"[^>]*title="([^"]*)"/i);
    if (!link) continue;
    const id = link[3] as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const name = decodeEntities(card.match(/blocoproduto__title[^>]*>([^<]*)</)?.[1] ?? (link[4] as string)).replace(/\s+/g, ' ').trim();
    const image = card.match(/data-src="(https:\/\/img\.kalunga\.com\.br\/fotosdeprodutos\/[^"]+\.jpg)"/i)?.[1] ?? null;
    products.push({
      id,
      slug: link[2] as string,
      url: `${SITE}${link[1]}`,
      name,
      image,
      price: parsePrice(card.match(/blocoproduto__price[^>]*>([^<]*)</)?.[1]),
      listPrice: parsePrice(card.match(/De:?\s*(R\$[^<]*)</)?.[1]),
      rating: parseStars(card),
    });
  }
  return products;
}

export function parseListingPage(response: { templateProdutos?: string | null; templatePaginacao?: string | null }): ListingPage {
  const pagination = parsePagination(response.templatePaginacao);
  return { products: parseListing(response.templateProdutos), ...pagination };
}

function hidden(html: string, id: string): string | null {
  const match = html.match(new RegExp(`id="${id}"[^>]*value="([^"]*)"`));
  return match ? decodeEntities(match[1] as string).trim() : null;
}

/** Campos que a página HTML do produto expõe (JSON do GA4, inputs ocultos, imagens, descrição). */
export interface ProductPageData {
  id: string | null;
  name: string | null;
  brand: ProductBrand | null;
  categoryPath: string | null;
  department: string | null;
  price: ProductPrice;
  images: ProductImage[];
  description: { html: string; text: string } | null;
  available: boolean;
}

function parseInstallments(text: string | null, total: number | null): ProductPrice['installments'] {
  const match = text?.match(/(\d+)\s*x\s*de\s*(R\$\s*[\d.,]+)/i);
  if (!match) return null;
  return { count: Number(match[1]), amount: parsePrice(match[2]) ?? 0, total };
}

export function parseImages(html: string, id: string | null): ProductImage[] {
  if (!id) return [];
  const found = new Set<string>();
  for (const match of html.matchAll(/https:\/\/img\.kalunga\.com\.br\/fotosdeprodutos\/(\d+)([dz])(_\d+)?\.jpg/gi)) {
    if (match[1] === id) found.add(`${match[2]?.toLowerCase()}${match[3] ?? ''}`);
  }
  const suffixes = [...found].filter((key) => key.startsWith('d')).map((key) => key.slice(1));
  suffixes.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : Number(a.slice(1)) - Number(b.slice(1))));
  const base = 'https://img.kalunga.com.br/fotosdeprodutos/';
  return suffixes.map((suffix) => ({ thumb: `${base}${id}d${suffix}.jpg`, large: found.has(`z${suffix}`) ? `${base}${id}z${suffix}.jpg` : null }));
}

interface Ga4Item {
  item_name?: string;
  item_brand?: string;
  item_category?: string;
  price?: number;
}

/** Primeiro item do `view_item` do GA4 embutido na página; `null` se ausente ou inválido. */
function parseGa4Item(raw: string | undefined): Ga4Item | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeEntities(raw).trim()) as Array<{ ecommerce?: { items?: Ga4Item[] } }>;
    return parsed[0]?.ecommerce?.items?.[0] ?? null;
  } catch {
    return null;
  }
}

export function parseProductPage(html: string): ProductPageData {
  const id = hidden(html, 'txtSku') ?? hidden(html, 'hdnProduto');
  const ga4Raw = html.match(/id="datalayerGA4"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  const ga4 = parseGa4Item(ga4Raw);
  const brandLink = html.match(/class="[^"]*marca-produto"[^>]*href="(\/marca\/([a-z0-9-]+)\/(\d+)\/(\d+))"[^>]*title="([^"]*)"/i);
  const brand: ProductBrand | null = brandLink
    ? { id: brandLink[3] as string, name: decodeEntities(brandLink[5] as string).trim(), slug: brandLink[2] as string, url: `${SITE}${brandLink[1]}` }
    : null;
  const name = decodeEntities(html.match(/<h1[^>]*id="h5produtoDescricao"[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? ga4?.item_name ?? hidden(html, 'txtDescSku') ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const current =
    parsePrice(hidden(html, 'txtPrecoVista')) ??
    parsePrice(html.match(/id="precovista"[^>]*>([^<]*)</)?.[1]) ??
    parsePrice(html.match(/id="precovenda"[^>]*>([^<]*)</)?.[1]) ??
    (typeof ga4?.price === 'number' ? ga4.price : null);
  const description = html.match(/id="descricaoPadrao"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? null;
  return {
    id,
    name: name || null,
    brand,
    categoryPath: ga4?.item_category ?? null,
    department: hidden(html, 'hdnDsDepartamento'),
    price: {
      current,
      list: parsePrice(hidden(html, 'txtDePor')),
      installments: parseInstallments(hidden(html, 'txtParcelamento'), parsePrice(hidden(html, 'txtTotalPrazo'))),
      currency: 'BRL',
    },
    images: parseImages(html, id),
    description: description ? { html: sanitizeHtml(description), text: htmlToText(description) } : null,
    available: /btn-comprar/.test(html) && !/avise-me|indispon[ií]vel no momento/i.test(html.slice(0, 200000)),
  };
}

export interface ProductDetailsJson {
  produto?: { Classificacao?: string; Codigo?: string; Descricao?: string; Fabricante?: string; Grupo?: string; SubGrupo?: string; PrecoVenda?: number };
}

/** Caminho "Depto/Grupo/Subgrupo" a partir do JSON de detalhes ou do GA4. */
export function categoryFromDetails(details: ProductDetailsJson | null, fallbackPath: string | null): { department: string; group: string | null; subgroup: string | null; path: string } {
  const produto = details?.produto;
  if (produto?.Classificacao) {
    const parts = [produto.Classificacao, produto.Grupo ?? null, produto.SubGrupo ?? null];
    return { department: produto.Classificacao, group: produto.Grupo ?? null, subgroup: produto.SubGrupo ?? null, path: parts.filter(Boolean).join('/') };
  }
  const parts = (fallbackPath ?? '').split('/').map((part) => part.trim()).filter(Boolean);
  return { department: parts[0] ?? '', group: parts[1] ?? null, subgroup: parts[2] ?? null, path: parts.join('/') };
}
