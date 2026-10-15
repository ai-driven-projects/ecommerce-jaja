import 'category_entity.dart';
import 'product_query.dart';

// Consultas da aba Início, copiadas de `StorefrontHome` em
// `apps/frontend/src/modules/catalog/components/storefront-home.component.tsx`:
// 12 destaques na ordem `featured`, 8 ofertas do maior para o menor desconto
// e até 12 categorias em destaque.

const homeFeaturedQuery = ProductQuery(
  featured: true,
  sort: ProductSort.featured,
  pageSize: 12,
);

const homeOffersQuery = ProductQuery(
  onSale: true,
  sort: ProductSort.discount,
  pageSize: 8,
);

const homeHighlightedCategoriesLimit = 12;

/// Categoria em destaque com o slug da raiz dela (quem dá o emoji e o tom).
typedef HighlightedCategory = ({Category category, String rootSlug});

/// Categorias marcadas como destaque e com produtos, em pré-ordem (cada raiz
/// e, depois, as descendentes dela, na ordem da API), até [limit]. Cópia de
/// `highlightedCategories` em
/// `apps/frontend/src/modules/catalog/data/storefront-category.util.ts`.
List<HighlightedCategory> highlightedCategories(
  List<Category> tree,
  int limit,
) {
  final result = <HighlightedCategory>[];

  void visit(Category node, String rootSlug) {
    if (result.length >= limit) return;
    if (node.isHighlighted && node.productCount > 0) {
      result.add((category: node, rootSlug: rootSlug));
    }
    for (final child in node.children) {
      visit(child, rootSlug);
    }
  }

  for (final root in tree) {
    visit(root, root.slug);
  }
  return List.unmodifiable(result);
}
