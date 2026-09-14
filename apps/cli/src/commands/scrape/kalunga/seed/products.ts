import { PRODUCT_MAX_IMAGES } from '@jaja/catalog';
import { Alias } from '@mentoria-360/shared';
import type { CategoryFile, ProductImage, ScrapedProduct } from '../types.js';
import type { CategoryLookup } from './categories.js';
import type { ProductImageSeedItem, ProductSeedItem } from './types.js';

/** Limite de `ProductDescription` no domínio. */
const DESCRIPTION_MAX_LENGTH = 5000;

/** Quantidade de produtos em destaque no seed. */
export const FEATURED_LIMIT = 24;
/** Candidatos a destaque: disponíveis, com pelo menos estas avaliações e estrelas. */
const FEATURED_MIN_RATINGS = 10;
const FEATURED_MIN_STARS = 4;

interface FeaturedCandidate {
  item: ProductSeedItem;
  stars: number;
  count: number;
}

/** Produto com o departamento do arquivo em que apareceu primeiro (o `category.department` do produto costuma ser outro). */
interface SourceProduct {
  department: string;
  product: ScrapedProduct;
}

export interface ProductBuild {
  products: ProductSeedItem[];
  /** Situações que não impedem a geração (categoria resolvida no departamento, produto ignorado). */
  warnings: string[];
  stats: { entries: number; skipped: number; withoutBrand: number; suffixedSlugs: number; fallbacks: number; truncatedImages: number; completedImages: number; droppedImages: number; featured: number };
}

/**
 * Marca `isFeatured` nos `FEATURED_LIMIT` candidatos mais avaliados: quantidade de avaliações decrescente,
 * depois estrelas decrescentes, depois o sku. Os demais produtos continuam com `false`. Devolve quantos marcou.
 */
function markFeatured(candidates: FeaturedCandidate[]): number {
  const chosen = [...candidates]
    .sort((a, b) => b.count - a.count || b.stars - a.stars || (a.item.sku < b.item.sku ? -1 : a.item.sku > b.item.sku ? 1 : 0))
    .slice(0, FEATURED_LIMIT);
  for (const { item } of chosen) item.isFeatured = true;
  return chosen.length;
}

/** Arquivos na ordem recebida (alfabética em `readCategories`), deduplicados pelo código: vale a primeira ocorrência. */
function uniqueProducts(files: CategoryFile[]): { sources: SourceProduct[]; entries: number } {
  const byCode = new Map<string, SourceProduct>();
  let entries = 0;
  for (const file of files) {
    const department = file.category.name.trim();
    for (const product of file.products) {
      entries += 1;
      const code = String(product.id).trim();
      if (!byCode.has(code)) byCode.set(code, { department, product });
    }
  }
  return { sources: [...byCode.values()], entries };
}

/** "... CX 12 UN" → "caixa com 12", "... PT 100 UN" → "pacote com 100"; o resto (inclusive "1 UN", "BL 20 FL") é unidade. */
export function unitFromName(name: string): string {
  const box = name.match(/\bCX\s+(\d+)\s+UN\s*$/i);
  if (box) return `caixa com ${Number(box[1])}`;
  const pack = name.match(/\bPT\s+(\d+)\s+UN\s*$/i);
  if (pack) return `pacote com ${Number(pack[1])}`;
  return 'unidade';
}

/**
 * Algumas imagens raspadas têm só um dos tamanhos: a URL disponível vale para os dois, e a imagem sem
 * nenhuma é descartada. Roda antes do limite de imagens, então ficam as primeiras utilizáveis.
 */
function usableImages(images: ProductImage[]): { images: Omit<ProductImageSeedItem, 'order'>[]; completed: number; dropped: number } {
  const usable: Omit<ProductImageSeedItem, 'order'>[] = [];
  let completed = 0;
  let dropped = 0;
  for (const image of images) {
    const thumb = typeof image.thumb === 'string' ? image.thumb.trim() : '';
    const large = typeof image.large === 'string' ? image.large.trim() : '';
    if (!thumb && !large) {
      dropped += 1;
      continue;
    }
    if (!thumb || !large) completed += 1;
    usable.push({ thumbUrl: thumb || large, largeUrl: large || thumb });
  }
  return { images: usable, completed, dropped };
}

function toCents(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** Produtos no formato do seed: preços em centavos, marca e categoria por slug, imagens limitadas e slugs únicos. */
export function buildProducts(files: CategoryFile[], brandSlugs: Set<string>, lookup: CategoryLookup): ProductBuild {
  const { sources, entries } = uniqueProducts(files);
  const products: ProductSeedItem[] = [];
  const warnings: string[] = [];
  const slugOwners = new Set<string>();
  const candidates: FeaturedCandidate[] = [];
  const stats = { entries, skipped: 0, withoutBrand: 0, suffixedSlugs: 0, fallbacks: 0, truncatedImages: 0, completedImages: 0, droppedImages: 0, featured: 0 };

  const skip = (sku: string, reason: string) => {
    stats.skipped += 1;
    warnings.push(`${sku}: ${reason}; produto ignorado`);
  };

  for (const { department, product } of sources) {
    const sku = String(product.id).trim();
    const priceCents = toCents(product.price.current);
    if (priceCents === null) {
      skip(sku, 'sem preço');
      continue;
    }

    // Slug repetido por outro produto recebe o sku como sufixo.
    const baseSlug = Alias.format(product.slug || product.name);
    let slug = baseSlug;
    if (slugOwners.has(baseSlug)) {
      slug = `${baseSlug}-${Alias.format(sku)}`;
      stats.suffixedSlugs += 1;
    }
    if (!slug || slugOwners.has(slug)) {
      skip(sku, `slug "${baseSlug}" e "${slug}" já usados`);
      continue;
    }

    const group = product.category.group?.trim() ?? '';
    const subgroup = product.category.subgroup?.trim() ?? '';
    const category = lookup(department, group, subgroup);
    if (!category) {
      skip(sku, `departamento "${department}" sem categoria`);
      continue;
    }
    if (category.fallback) {
      stats.fallbacks += 1;
      warnings.push(`${sku}: categoria "${department} / ${group} / ${subgroup}" não encontrada, usando o departamento`);
    }
    slugOwners.add(slug);

    const brand = Alias.format(product.brand?.slug ?? '');
    const brandSlug = brandSlugs.has(brand) ? brand : null;
    if (!brandSlug) stats.withoutBrand += 1;

    const { images, completed, dropped } = usableImages(product.images);
    stats.completedImages += completed;
    stats.droppedImages += dropped;
    if (images.length > PRODUCT_MAX_IMAGES) stats.truncatedImages += 1;

    const listCents = toCents(product.price.list);
    const description = product.description?.text.trim().slice(0, DESCRIPTION_MAX_LENGTH).trimEnd();

    const item: ProductSeedItem = {
      sku,
      name: product.name.trim(),
      slug,
      brandSlug,
      categorySlug: category.slug,
      description: description || null,
      priceCents,
      listPriceCents: listCents !== null && listCents > priceCents ? listCents : null,
      unit: unitFromName(product.name),
      images: images.slice(0, PRODUCT_MAX_IMAGES).map((image, order) => ({ ...image, order })),
      isActive: product.available === true,
      isFeatured: false,
    };
    products.push(item);

    const rating = product.rating;
    if (product.available === true && rating && rating.count >= FEATURED_MIN_RATINGS && rating.stars >= FEATURED_MIN_STARS) {
      candidates.push({ item, stars: rating.stars, count: rating.count });
    }
  }

  stats.featured = markFeatured(candidates);
  return { products, warnings, stats };
}
