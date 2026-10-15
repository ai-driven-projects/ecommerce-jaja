import 'product_detail_entity.dart';
import 'product_query.dart';
import 'product_summary_entity.dart';

// Regras da página do produto, copiadas de `ProductDetail` em
// `apps/frontend/src/modules/catalog/components/product-detail.component.tsx`:
// "Mais de <categoria>" pede um produto a mais que o limite (o próprio pode
// vir na lista) e a raiz da trilha escolhe o emoji e o tom de reserva.

const relatedProductsLimit = 4;

/// Consulta de "Mais de `<categoria>`": a categoria do produto (a última da
/// trilha), na ordem `featured`, com [relatedProductsLimit] + 1 itens. `null`
/// quando o produto não tem categoria.
ProductQuery? relatedProductsQuery(ProductDetail product) {
  if (product.categories.isEmpty) return null;
  return ProductQuery(
    categorySlug: product.categories.last.slug,
    sort: ProductSort.featured,
    pageSize: relatedProductsLimit + 1,
  );
}

/// [items] sem o produto [productId], no máximo [relatedProductsLimit].
List<ProductSummary> relatedProducts(
  List<ProductSummary> items,
  String productId,
) {
  return List.unmodifiable(
    items.where((item) => item.id != productId).take(relatedProductsLimit),
  );
}

/// Slug da raiz da trilha, ou `''` sem categorias (que cai na reserva do
/// `categoryArtOf`).
String rootCategorySlugOf(ProductDetail product) {
  return product.categories.isEmpty ? '' : product.categories.first.slug;
}
