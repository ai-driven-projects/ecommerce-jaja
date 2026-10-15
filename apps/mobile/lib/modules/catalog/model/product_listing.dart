import 'product_query.dart';

// Regras da listagem da aba Buscar, copiadas de
// `apps/frontend/src/modules/catalog/data/storefront-query.util.ts`
// (`effectiveOrder`, `applyStorefrontChanges`, `hasCatalogFilters`) e de
// `components/storefront-listing.component.tsx` (`LISTING_PAGE_SIZE` e as
// opções de ordem). O limite de marcas é o `MAX_BRAND_SLUGS` do
// `StorefrontController`.

/// Produtos por página da listagem (`LISTING_PAGE_SIZE` do web).
const listingPageSize = 24;

/// Máximo de marcas num filtro, como a API.
const maxBrandSlugs = 20;

/// Ordem efetiva: a escolhida ou a padrão da API (relevância com busca,
/// destaques sem).
ProductSort effectiveSort(ProductQuery query) =>
    query.sort ??
    (query.search != null ? ProductSort.relevance : ProductSort.featured);

/// Ordens oferecidas, na ordem do web; "Mais relevantes" só com busca.
List<ProductSort> listingSorts(ProductQuery query) => List.unmodifiable(
  ProductSort.values.where(
    (sort) => sort != ProductSort.relevance || query.search != null,
  ),
);

/// O filtro "em vigor" da listagem: sem `page`/`pageSize`, busca aparada
/// (vazia vira `null`), marcas sem vazias e sem repetição (no máximo
/// [maxBrandSlugs]) e `relevance` sem busca volta à ordem padrão.
ProductQuery normalizeListingQuery(ProductQuery query) {
  final search = query.search?.trim() ?? '';
  final brands = query.brandSlugs
      .map((slug) => slug.trim())
      .where((slug) => slug.isNotEmpty)
      .toSet()
      .take(maxBrandSlugs)
      .toList();
  final hasSearch = search.isNotEmpty;

  return query.copyWith(
    page: null,
    pageSize: null,
    search: hasSearch ? search : null,
    brandSlugs: List.unmodifiable(brands),
    sort: query.sort == ProductSort.relevance && !hasSearch ? null : query.sort,
  );
}

/// Categoria, marcas, preço, só ofertas ou só destaques (busca e ordem não
/// contam).
bool hasCatalogFilters(ProductQuery query) =>
    query.categorySlug != null ||
    query.brandSlugs.isNotEmpty ||
    query.minPriceCents != null ||
    query.maxPriceCents != null ||
    query.onSale ||
    query.featured;

/// Tira os filtros de [hasCatalogFilters], mantendo a busca e a ordem.
ProductQuery clearCatalogFilters(ProductQuery query) => query.copyWith(
  categorySlug: null,
  brandSlugs: const [],
  minPriceCents: null,
  maxPriceCents: null,
  onSale: false,
  featured: false,
);

/// A consulta enviada ao repositório para a página [page] do filtro [query].
ProductQuery listingPageQuery(ProductQuery query, int page) =>
    query.copyWith(page: page, pageSize: listingPageSize);
