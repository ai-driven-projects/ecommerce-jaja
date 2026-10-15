import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/infra/store/api_store_repository.dart';
import 'package:mobile/modules/store/model/store_entity.dart';

import '../../modules/store/support/store_fixtures.dart';
import '../api/support/storefront_store_json.dart';
import '../http/support/fake_http_client_adapter.dart';
import '../storage/support/fake_key_value_store.dart';

void main() {
  late FakeHttpClientAdapter adapter;
  late FakeKeyValueStore storage;
  late ApiStoreRepository repository;

  setUp(() {
    adapter = FakeHttpClientAdapter();
    storage = FakeKeyValueStore();
    final dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter;
    repository = ApiStoreRepository(dio, storage);
  });

  List<Store> storesOf(Result<List<Store>> result) =>
      (result as Ok<List<Store>>).value;

  AppFailure failureOf(Result<List<Store>> result) =>
      (result as Failure<List<Store>>).failure;

  group('fetchStores', () {
    test(
      'faz GET /storefront/stores sem Authorization e lê as lojas do seed',
      () async {
        adapter.enqueueResponse(body: storefrontStoresJson);

        final result = await repository.fetchStores();

        expect(adapter.requests, hasLength(1));
        final request = adapter.requests.single;
        expect(request.method, 'GET');
        expect(
          request.uri.toString(),
          'http://localhost:4000/storefront/stores',
        );
        expect(
          request.headers.keys.map((key) => key.toLowerCase()),
          isNot(contains('authorization')),
        );
        expect(request.uri.queryParameters, isEmpty);
        expect(storesOf(result), [paulista, rioBranco]);
      },
    );

    test('a segunda chamada reaproveita a lista sem nova requisição', () async {
      adapter.enqueueResponse(body: storefrontStoresJson);
      final first = await repository.fetchStores();

      final second = await repository.fetchStores();

      expect(adapter.requests, hasLength(1));
      expect(storesOf(second), storesOf(first));
    });

    test('refresh: true faz nova requisição e substitui a lista', () async {
      adapter.enqueueResponse(body: storefrontStoresJson);
      await repository.fetchStores();
      adapter.enqueueResponse(body: const [paulistaJson]);

      final refreshed = await repository.fetchStores(refresh: true);
      final after = await repository.fetchStores();

      expect(adapter.requests, hasLength(2));
      expect(storesOf(refreshed), [paulista]);
      expect(storesOf(after), [paulista]);
    });

    test('falha vira NetworkFailure e não é guardada', () async {
      adapter.enqueueError(DioExceptionType.connectionError);
      final failed = await repository.fetchStores();
      adapter.enqueueResponse(body: storefrontStoresJson);

      final retried = await repository.fetchStores();

      expect(failureOf(failed), isA<NetworkFailure>());
      expect(adapter.requests, hasLength(2));
      expect(storesOf(retried), [paulista, rioBranco]);
    });

    test('duas chamadas simultâneas fazem uma requisição só', () async {
      adapter.enqueueResponse(body: storefrontStoresJson);

      final results = await Future.wait([
        repository.fetchStores(),
        repository.fetchStores(),
      ]);

      expect(adapter.requests, hasLength(1));
      expect(storesOf(results[0]), [paulista, rioBranco]);
      expect(storesOf(results[1]), [paulista, rioBranco]);
    });

    test('depois da requisição compartilhada, refresh faz outra', () async {
      adapter.enqueueResponse(body: storefrontStoresJson);
      await Future.wait([repository.fetchStores(), repository.fetchStores()]);
      adapter.enqueueResponse(body: const <Object?>[]);

      final refreshed = await repository.fetchStores(refresh: true);

      expect(adapter.requests, hasLength(2));
      expect(storesOf(refreshed), isEmpty);
    });

    test('200 com item sem slug vira UnexpectedFailure', () async {
      final broken = Map<String, Object?>.of(rioBrancoJson)..remove('slug');
      adapter.enqueueResponse(body: [paulistaJson, broken]);

      final result = await repository.fetchStores();

      final failure = failureOf(result);
      expect(failure, isA<UnexpectedFailure>());
      expect(failure.code, HttpFailureCode.unexpected);
      expect(failure.message, 'Algo deu errado. Tente novamente.');
    });

    test('200 com corpo que não é lista vira UnexpectedFailure', () async {
      adapter.enqueueResponse(body: paulistaJson);

      final result = await repository.fetchStores();

      expect(failureOf(result), isA<UnexpectedFailure>());
    });
  });

  group('lembrança da loja escolhida', () {
    test('grava o slug na chave jaja:vitrine:loja e lê de volta', () async {
      await repository.rememberChosenSlug('loja-rio-branco');

      expect(storage.values, {'jaja:vitrine:loja': 'loja-rio-branco'});
      expect(await repository.readChosenSlug(), 'loja-rio-branco');
    });

    test('sem lembrança devolve null', () async {
      expect(await repository.readChosenSlug(), isNull);
    });

    test('lembrança só com espaços conta como ausente', () async {
      storage.values['jaja:vitrine:loja'] = '  ';

      expect(await repository.readChosenSlug(), isNull);
    });

    test('lembrança com espaços nas pontas é lida sem eles', () async {
      storage.values['jaja:vitrine:loja'] = ' loja-paulista ';

      expect(await repository.readChosenSlug(), 'loja-paulista');
    });

    test('memória ilegível lê null e gravação falha sem exceção', () async {
      final failing = FakeKeyValueStore(
        initialValues: {'jaja:vitrine:loja': 'loja-rio-branco'},
        failOnRead: true,
        failOnWrite: true,
      );
      final dio = createApiClient(Uri.parse('http://localhost:4000'))
        ..httpClientAdapter = adapter;
      final repository = ApiStoreRepository(dio, failing);

      await expectLater(
        repository.rememberChosenSlug('loja-paulista'),
        completes,
      );
      expect(await repository.readChosenSlug(), isNull);
      expect(failing.values, {'jaja:vitrine:loja': 'loja-rio-branco'});
    });
  });
}
