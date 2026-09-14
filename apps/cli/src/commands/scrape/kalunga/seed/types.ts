/**
 * Formato dos arquivos de `apps/backend/prisma/seed/data`. Espelha os models do Prisma:
 * marca e categoria são referenciadas por slug, porque os ids são gerados por cada banco.
 */

/** Item de `brands.json`. */
export interface BrandSeedItem {
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  isActive: boolean;
}

/** Item de `categories.json`; as pais vêm antes das filhas. */
export interface CategorySeedItem {
  name: string;
  slug: string;
  parentSlug: string | null;
  description: string | null;
  order: number;
  isHighlighted: boolean;
  imageUrl: string | null;
  isActive: boolean;
}

export interface ProductImageSeedItem {
  thumbUrl: string;
  largeUrl: string;
  order: number;
}

/** Item de `products.json`. */
export interface ProductSeedItem {
  sku: string;
  name: string;
  slug: string;
  brandSlug: string | null;
  categorySlug: string;
  description: string | null;
  priceCents: number;
  listPriceCents: number | null;
  unit: string;
  images: ProductImageSeedItem[];
  isActive: boolean;
  /** Destaque na vitrine: os produtos mais avaliados entre os candidatos (`buildProducts`). */
  isFeatured: boolean;
}

export interface SeedData {
  brands: BrandSeedItem[];
  categories: CategorySeedItem[];
  products: ProductSeedItem[];
}
