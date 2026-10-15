import 'package:freezed_annotation/freezed_annotation.dart';

part 'product_query.freezed.dart';

/// Ordenações de `GET /storefront/products` (`STOREFRONT_PRODUCT_SORTS` em
/// `modules/catalog`). Sem `sort`, a API usa `relevance` com busca e
/// `featured` sem.
enum ProductSort {
  relevance('relevance'),
  featured('featured'),
  priceAsc('price-asc'),
  priceDesc('price-desc'),
  name('name'),
  discount('discount');

  const ProductSort(this.apiValue);

  /// Valor que a API aceita e devolve.
  final String apiValue;

  /// `null` para valor desconhecido ou ausente.
  static ProductSort? fromApiValue(String? value) {
    for (final sort in values) {
      if (sort.apiValue == value) return sort;
    }
    return null;
  }
}

/// Filtros de uma listagem de produtos, todos combinados com E. Campo nulo
/// (ou lista vazia, ou `false`) é filtro não definido e fica fora da chamada.
@freezed
abstract class ProductQuery with _$ProductQuery {
  const factory ProductQuery({
    int? page,
    int? pageSize,
    String? search,
    String? categorySlug,
    @Default([]) List<String> brandSlugs,
    int? minPriceCents,
    int? maxPriceCents,
    @Default(false) bool onSale,
    @Default(false) bool featured,
    ProductSort? sort,
  }) = _ProductQuery;
}
