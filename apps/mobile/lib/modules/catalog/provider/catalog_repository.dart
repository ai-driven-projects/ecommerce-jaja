import '../../../core/result.dart';
import '../model/category_entity.dart';
import '../model/product_detail_entity.dart';
import '../model/product_page_entity.dart';
import '../model/product_query.dart';

abstract interface class CatalogRepository {
  /// Árvore de categorias na ordem da API. A árvore do primeiro sucesso é
  /// reaproveitada enquanto o app está aberto; [refresh] busca de novo. Falha
  /// não é guardada.
  Future<Result<List<Category>>> fetchCategories({bool refresh = false});

  /// Uma página de produtos pelos filtros de [query]. Nunca é reaproveitada
  /// entre pedidos.
  Future<Result<ProductPage>> fetchProducts(ProductQuery query);

  /// O detalhe do produto [slug]. Nunca é reaproveitado entre pedidos; slug
  /// inexistente vira `NotFoundFailure`.
  Future<Result<ProductDetail>> fetchProduct(String slug);
}
