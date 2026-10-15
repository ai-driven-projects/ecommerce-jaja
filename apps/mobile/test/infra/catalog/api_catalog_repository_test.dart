import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/catalog/api_catalog_repository.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/modules/catalog/model/category_entity.dart';
import 'package:mobile/modules/catalog/model/home_catalog.dart';
import 'package:mobile/modules/catalog/model/product_page_entity.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';

import '../../modules/catalog/support/catalog_fixtures.dart';
import '../api/support/storefront_catalog_json.dart';
import '../api/support/storefront_product_detail_json.dart';
import '../http/support/fake_http_client_adapter.dart';

void main() {
  late FakeHttpClientAdapter adapter;
  late ApiCatalogRepository repository;

  setUp(() {
    adapter = FakeHttpClientAdapter();
    final dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter;
    repository = ApiCatalogRepository(dio);
  });

  T valueOf<T>(Result<T> result) => (result as Ok<T>).value;

  AppFailure failureOf<T>(Result<T> result) => (result as Failure<T>).failure;

  group('fetchCategories', () {
    test(
      'faz GET /storefront/categories sem Authorization e lê a árvore',
      () async {
        adapter.enqueueResponse(body: storefrontCategoriesJson);

        final result = await repository.fetchCategories();

        expect(adapter.requests, hasLength(1));
        final request = adapter.requests.single;
        expect(request.method, 'GET');
        expect(
          request.uri.toString(),
          'http://localhost:4000/storefront/categories',
        );
        expect(
          request.headers.keys.map((key) => key.toLowerCase()),
          isNot(contains('authorization')),
        );
        expect(request.uri.queryParameters, isEmpty);
        expect(valueOf(result), categoryTree);
      },
    );

    test(
      'a segunda chamada reaproveita a árvore sem nova requisição',
      () async {
        adapter.enqueueResponse(body: storefrontCategoriesJson);
        final first = await repository.fetchCategories();

        final second = await repository.fetchCategories();

        expect(adapter.requests, hasLength(1));
        expect(valueOf(second), valueOf(first));
      },
    );

    test('refresh: true faz nova requisição e substitui a árvore', () async {
      adapter.enqueueResponse(body: storefrontCategoriesJson);
      await repository.fetchCategories();
      adapter.enqueueResponse(body: const [escolarJson]);

      final refreshed = await repository.fetchCategories(refresh: true);
      final after = await repository.fetchCategories();

      expect(adapter.requests, hasLength(2));
      expect(valueOf(refreshed), [escolar]);
      expect(valueOf(after), [escolar]);
    });

    test('falha vira NetworkFailure e não é guardada', () async {
      adapter.enqueueError(DioExceptionType.connectionError);
      final failed = await repository.fetchCategories();
      adapter.enqueueResponse(body: storefrontCategoriesJson);

      final retried = await repository.fetchCategories();

      expect(failureOf(failed), isA<NetworkFailure>());
      expect(adapter.requests, hasLength(2));
      expect(valueOf(retried), categoryTree);
    });

    test('duas chamadas simultâneas fazem uma requisição só', () async {
      adapter.enqueueResponse(body: storefrontCategoriesJson);

      final results = await Future.wait([
        repository.fetchCategories(),
        repository.fetchCategories(),
      ]);

      expect(adapter.requests, hasLength(1));
      expect(valueOf(results[0]), categoryTree);
      expect(valueOf(results[1]), categoryTree);
    });

    test('200 com nó sem slug vira UnexpectedFailure', () async {
      final broken = Map<String, Object?>.of(escolarJson)..remove('slug');
      adapter.enqueueResponse(body: [artesPinturaJson, broken]);

      final result = await repository.fetchCategories();

      final failure = failureOf(result);
      expect(failure, isA<UnexpectedFailure>());
      expect(failure.code, HttpFailureCode.unexpected);
      expect(failure.message, 'Algo deu errado. Tente novamente.');
    });

    test('200 com corpo que não é lista vira UnexpectedFailure', () async {
      adapter.enqueueResponse(body: escolarJson);

      final result = await repository.fetchCategories();

      expect(failureOf(result), isA<UnexpectedFailure>());
    });

    test('500 vira ServerFailure', () async {
      adapter.enqueueResponse(statusCode: 500, body: 'Internal Server Error');

      final result = await repository.fetchCategories();

      final failure = failureOf(result);
      expect(failure, isA<ServerFailure>());
      expect(failure.code, HttpFailureCode.server);
    });
  });

  group('fetchProducts', () {
    test(
      'destaques da Início: GET /storefront/products com '
      'featured=true, sort=featured e pageSize=12, sem Authorization',
      () async {
        adapter.enqueueResponse(body: storefrontProductPageJson);

        final result = await repository.fetchProducts(homeFeaturedQuery);

        expect(adapter.requests, hasLength(1));
        final request = adapter.requests.single;
        expect(request.method, 'GET');
        expect(request.uri.path, '/storefront/products');
        expect(request.uri.queryParameters, {
          'featured': 'true',
          'sort': 'featured',
          'pageSize': '12',
        });
        expect(
          request.headers.keys.map((key) => key.toLowerCase()),
          isNot(contains('authorization')),
        );
        final page = valueOf(result);
        expect(page.items, products);
        expect(page.total, 96);
        expect(page.totalPages, 12);
        expect(page.brandFacets.map((facet) => facet.name), [
          'Faber-Castell',
          'Master',
        ]);
      },
    );

    test(
      'ofertas da Início mandam onSale=true, sort=discount e pageSize=8',
      () async {
        adapter.enqueueResponse(body: storefrontProductPageJson);

        await repository.fetchProducts(homeOffersQuery);

        expect(adapter.requests.single.uri.queryParameters, {
          'onSale': 'true',
          'sort': 'discount',
          'pageSize': '8',
        });
      },
    );

    test('consulta vazia não manda parâmetro nenhum', () async {
      adapter.enqueueResponse(body: storefrontProductPageJson);

      await repository.fetchProducts(const ProductQuery());

      expect(
        adapter.requests.single.uri.toString(),
        'http://localhost:4000/storefront/products',
      );
    });

    test('duas chamadas fazem duas requisições (nada é guardado)', () async {
      adapter.enqueueResponse(body: storefrontProductPageJson);
      adapter.enqueueResponse(body: storefrontProductPageJson);

      final first = await repository.fetchProducts(homeFeaturedQuery);
      final second = await repository.fetchProducts(homeFeaturedQuery);

      expect(adapter.requests, hasLength(2));
      expect(valueOf(first).items, products);
      expect(valueOf(second).items, products);
    });

    test('200 com priceCents: -1 vira UnexpectedFailure', () async {
      adapter.enqueueResponse(
        body: {
          ...storefrontProductPageJson,
          'items': [
            {...finePenJson, 'priceCents': -1},
          ],
        },
      );

      final result = await repository.fetchProducts(homeFeaturedQuery);

      final failure = failureOf(result);
      expect(failure, isA<UnexpectedFailure>());
      expect(failure.code, HttpFailureCode.unexpected);
      expect(failure.message, 'Algo deu errado. Tente novamente.');
    });

    test('200 com corpo sem items vira UnexpectedFailure', () async {
      final broken = Map<String, Object?>.of(storefrontProductPageJson)
        ..remove('items');
      adapter.enqueueResponse(body: broken);

      final result = await repository.fetchProducts(homeOffersQuery);

      expect(failureOf(result), isA<UnexpectedFailure>());
    });

    test('500 vira ServerFailure', () async {
      adapter.enqueueResponse(statusCode: 500, body: 'Internal Server Error');

      final result = await repository.fetchProducts(homeFeaturedQuery);

      final failure = failureOf(result);
      expect(failure, isA<ServerFailure>());
      expect(failure.code, HttpFailureCode.server);
      expect(
        failure.message,
        'O servidor está indisponível no momento. Tente novamente em instantes.',
      );
    });

    test('400 do backend vira BackendRejectionFailure', () async {
      adapter.enqueueResponse(
        statusCode: 400,
        body: {'statusCode': 400, 'message': 'INVALID_FILTERS'},
      );

      final result = await repository.fetchProducts(homeFeaturedQuery);

      expect(failureOf(result), isA<BackendRejectionFailure>());
    });
  });

  group('fetchProduct', () {
    test(
      'faz GET /storefront/products/<slug> sem Authorization e lê o detalhe',
      () async {
        adapter.enqueueResponse(body: tonerDetailJson);

        final result = await repository.fetchProduct(tonerDetail.slug);

        expect(adapter.requests, hasLength(1));
        final request = adapter.requests.single;
        expect(request.method, 'GET');
        expect(
          request.uri.toString(),
          'http://localhost:4000/storefront/products/${tonerDetail.slug}',
        );
        expect(
          request.headers.keys.map((key) => key.toLowerCase()),
          isNot(contains('authorization')),
        );
        expect(valueOf(result), tonerDetail);
      },
    );

    test('o slug sai codificado no caminho', () async {
      adapter.enqueueResponse(body: plainDetailJson);

      await repository.fetchProduct('caneta x');

      expect(
        adapter.requests.single.uri.toString(),
        'http://localhost:4000/storefront/products/caneta%20x',
      );
    });

    test('duas chamadas fazem duas requisições (nada é guardado)', () async {
      adapter.enqueueResponse(body: plainDetailJson);
      adapter.enqueueResponse(body: plainDetailJson);

      final first = await repository.fetchProduct('caneta-x');
      final second = await repository.fetchProduct('caneta-x');

      expect(adapter.requests, hasLength(2));
      expect(valueOf(first), plainDetail);
      expect(valueOf(second), plainDetail);
    });

    test('404 vira NotFoundFailure', () async {
      adapter.enqueueResponse(
        statusCode: 404,
        body: {'statusCode': 404, 'message': 'PRODUCT_NOT_FOUND'},
      );

      final result = await repository.fetchProduct('nao-existe');

      final failure = failureOf(result);
      expect(failure, isA<NotFoundFailure>());
      expect(failure.code, HttpFailureCode.notFound);
    });

    test('500 vira ServerFailure', () async {
      adapter.enqueueResponse(statusCode: 500, body: 'Internal Server Error');

      final result = await repository.fetchProduct('caneta-x');

      final failure = failureOf(result);
      expect(failure, isA<ServerFailure>());
      expect(failure.code, HttpFailureCode.server);
    });

    test('200 com priceCents: -1 vira UnexpectedFailure', () async {
      adapter.enqueueResponse(body: {...plainDetailJson, 'priceCents': -1});

      final result = await repository.fetchProduct('caneta-x');

      final failure = failureOf(result);
      expect(failure, isA<UnexpectedFailure>());
      expect(failure.code, HttpFailureCode.unexpected);
    });
  });

  test('a árvore guardada e a página são entidades do domínio', () async {
    adapter.enqueueResponse(body: storefrontCategoriesJson);
    adapter.enqueueResponse(body: storefrontProductPageJson);

    final tree = valueOf(await repository.fetchCategories());
    final page = valueOf(await repository.fetchProducts(homeOffersQuery));

    expect(tree, isA<List<Category>>());
    expect(page, isA<ProductPage>());
  });
}
