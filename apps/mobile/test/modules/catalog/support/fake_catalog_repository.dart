import 'dart:async';
import 'dart:collection';

import 'package:mobile/core/result.dart';
import 'package:mobile/modules/catalog/model/category_entity.dart';
import 'package:mobile/modules/catalog/model/product_detail_entity.dart';
import 'package:mobile/modules/catalog/model/product_page_entity.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_summary_entity.dart';
import 'package:mobile/modules/catalog/provider/catalog_repository.dart';

import 'catalog_fixtures.dart' as fixtures;

/// Uma página com [items], para enfileirar nos fakes. Sem os nomeados, é a
/// única página do resultado, sem facetas; [total] padrão é o de itens.
ProductPage pageOf(
  List<ProductSummary> items, {
  int page = 1,
  int? totalPages,
  int? total,
  List<BrandFacet> brandFacets = const [],
}) => ProductPage(
  items: List.unmodifiable(items),
  total: total ?? items.length,
  page: page,
  pageSize: items.length,
  totalPages: totalPages ?? (items.isEmpty ? 0 : 1),
  brandFacets: List.unmodifiable(brandFacets),
);

/// [CatalogRepository] em memória para os testes de ViewModel e de página,
/// sem rede. Cada `fetchCategories` consome a próxima resposta enfileirada por
/// [enqueueCategories] ou [holdCategories]; cada `fetchProducts`, a próxima de
/// [enqueueProducts] ou [holdProducts]. Com a fila vazia, devolve as fixtures
/// do seed ([categories] e uma página com [products]). As respostas de
/// produtos saem na ordem das chamadas: na Início, destaques antes das ofertas.
/// Cada `fetchProduct` consome a próxima de [enqueueProduct] ou
/// [holdProduct]; com a fila vazia, devolve [product] ([fixtures.plainDetail]
/// por padrão). [categoryCalls] guarda o `refresh` de cada chamada,
/// [productQueries] cada consulta pedida e [productSlugs] cada slug pedido,
/// na ordem.
class FakeCatalogRepository implements CatalogRepository {
  FakeCatalogRepository({
    List<Category>? categories,
    List<ProductSummary>? products,
    ProductDetail? product,
  }) : categories = List.of(categories ?? fixtures.categoryTree),
       products = List.of(products ?? fixtures.products),
       product = product ?? fixtures.plainDetail;

  /// Árvore devolvida quando não há nada enfileirado.
  List<Category> categories;

  /// Itens da página devolvida quando não há nada enfileirado.
  List<ProductSummary> products;

  /// Detalhe devolvido quando não há nada enfileirado.
  ProductDetail product;

  final List<bool> categoryCalls = [];
  final List<ProductQuery> productQueries = [];
  final List<String> productSlugs = [];
  final Queue<Future<Result<List<Category>>>> _categoryResponses = Queue();
  final Queue<Future<Result<ProductPage>>> _productResponses = Queue();
  final Queue<Future<Result<ProductDetail>>> _detailResponses = Queue();

  void enqueueCategories(Result<List<Category>> result) {
    _categoryResponses.add(Future.value(result));
  }

  void enqueueProducts(Result<ProductPage> result) {
    _productResponses.add(Future.value(result));
  }

  void enqueueProduct(Result<ProductDetail> result) {
    _detailResponses.add(Future.value(result));
  }

  /// Segura o próximo `fetchCategories` até o teste completar o [Completer],
  /// para observar o estado "carregando".
  Completer<Result<List<Category>>> holdCategories() {
    final completer = Completer<Result<List<Category>>>();
    _categoryResponses.add(completer.future);
    return completer;
  }

  /// Segura o próximo `fetchProducts` até o teste completar o [Completer].
  Completer<Result<ProductPage>> holdProducts() {
    final completer = Completer<Result<ProductPage>>();
    _productResponses.add(completer.future);
    return completer;
  }

  /// Segura o próximo `fetchProduct` até o teste completar o [Completer].
  Completer<Result<ProductDetail>> holdProduct() {
    final completer = Completer<Result<ProductDetail>>();
    _detailResponses.add(completer.future);
    return completer;
  }

  @override
  Future<Result<List<Category>>> fetchCategories({bool refresh = false}) {
    categoryCalls.add(refresh);
    if (_categoryResponses.isEmpty) {
      return Future.value(Ok(List.unmodifiable(categories)));
    }
    return _categoryResponses.removeFirst();
  }

  @override
  Future<Result<ProductPage>> fetchProducts(ProductQuery query) {
    productQueries.add(query);
    if (_productResponses.isEmpty) {
      return Future.value(Ok(pageOf(products)));
    }
    return _productResponses.removeFirst();
  }

  @override
  Future<Result<ProductDetail>> fetchProduct(String slug) {
    productSlugs.add(slug);
    if (_detailResponses.isEmpty) return Future.value(Ok(product));
    return _detailResponses.removeFirst();
  }
}
