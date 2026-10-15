import '../../modules/catalog/model/product_query.dart';
import '../../modules/catalog/model/product_query_params.dart';

/// Caminhos das rotas do app, em inglês como o código.
abstract final class AppRoutes {
  static const String home = '/home';
  static const String search = '/search';
  static const String cart = '/cart';
  static const String account = '/account';

  /// Produto por slug, na pilha da aba Início (barra de abas visível).
  static const String product = '$home/$productSegment';

  /// O trecho de [product] relativo a [home], para a rota filha no router.
  static const String productSegment = 'product/:slug';

  static String productLocation(String slug) =>
      '$home/product/${Uri.encodeComponent(slug)}';

  /// Produto por slug, na pilha da aba Buscar (volta à listagem com o estado).
  static const String searchProduct = '$search/$searchProductSegment';

  /// O trecho de [searchProduct] relativo a [search], para a rota filha.
  static const String searchProductSegment = 'product/:slug';

  static String searchProductLocation(String slug) =>
      '$search/product/${Uri.encodeComponent(slug)}';

  /// A Buscar com os filtros na query, na codificação única dos filtros;
  /// sem `?` quando a consulta é vazia.
  static String searchLocation(ProductQuery query) {
    final params = encodeProductQuery(query);
    return Uri(
      path: search,
      queryParameters: params.isEmpty ? null : params,
    ).toString();
  }
}
