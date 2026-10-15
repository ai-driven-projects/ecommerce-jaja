import 'package:dio/dio.dart';

import '../../core/result.dart';
import '../../modules/catalog/model/category_entity.dart';
import '../../modules/catalog/model/product_detail_entity.dart';
import '../../modules/catalog/model/product_page_entity.dart';
import '../../modules/catalog/model/product_query.dart';
import '../../modules/catalog/model/product_query_params.dart';
import '../../modules/catalog/provider/catalog_repository.dart';
import '../api/storefront_category_dto.dart';
import '../api/storefront_product_detail_dto.dart';
import '../api/storefront_product_dto.dart';
import '../http/run_request.dart';

/// [CatalogRepository] sobre `GET /storefront/categories`,
/// `GET /storefront/products` e `GET /storefront/products/:slug` (públicos,
/// sem token). Registrado como
/// singleton: a árvore de categorias do primeiro sucesso vale enquanto o app
/// está aberto, como a carga única por montagem do shell no web; páginas de
/// produtos e detalhes nunca são guardados.
final class ApiCatalogRepository implements CatalogRepository {
  ApiCatalogRepository(this._dio);

  final Dio _dio;

  List<Category>? _loaded;
  Future<Result<List<Category>>>? _pending;

  @override
  Future<Result<List<Category>>> fetchCategories({bool refresh = false}) {
    final loaded = _loaded;
    if (!refresh && loaded != null) return Future.value(Ok(loaded));

    // Chamadas simultâneas compartilham a requisição em andamento (a mesma
    // guarda do `ApiStoreRepository`); a próxima chamada depois dela decide
    // sozinha.
    return _pending ??= _loadCategories().whenComplete(() => _pending = null);
  }

  Future<Result<List<Category>>> _loadCategories() async {
    final result = await runRequest(
      () => _dio.get<Object?>('/storefront/categories'),
      parseStorefrontCategories,
    );
    // Falha não é guardada: a próxima tentativa busca de novo.
    if (result case Ok(:final value)) _loaded = value;
    return result;
  }

  @override
  Future<Result<ProductPage>> fetchProducts(ProductQuery query) {
    return runRequest(
      () => _dio.get<Object?>(
        '/storefront/products',
        queryParameters: encodeProductQuery(query),
      ),
      parseStorefrontProductPage,
    );
  }

  @override
  Future<Result<ProductDetail>> fetchProduct(String slug) {
    // O `404` (`PRODUCT_NOT_FOUND`) já vira `NotFoundFailure` no mapeador.
    return runRequest(
      () => _dio.get<Object?>(
        '/storefront/products/${Uri.encodeComponent(slug)}',
      ),
      parseStorefrontProductDetail,
    );
  }
}
