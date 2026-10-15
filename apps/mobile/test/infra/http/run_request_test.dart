import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/infra/http/run_request.dart';

import 'support/fake_http_client_adapter.dart';

void main() {
  late FakeHttpClientAdapter adapter;
  late Dio dio;

  setUp(() {
    adapter = FakeHttpClientAdapter();
    dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter;
  });

  Future<Result<T>> get<T>(T Function(Object? data) parse) =>
      runRequest(() => dio.get<Object?>('/storefront/stores'), parse);

  group('runRequest', () {
    test('200 com corpo convertido vira sucesso', () async {
      adapter.enqueueResponse(
        body: [
          {'slug': 'jaja-centro'},
        ],
      );

      final result = await get(
        (data) => (data! as List<Object?>)
            .map((item) => (item! as Map<String, Object?>)['slug']! as String)
            .toList(),
      );

      expect(result, isA<Ok<List<String>>>());
      expect((result as Ok<List<String>>).value, ['jaja-centro']);
    });

    test('parse que lança TypeError vira falha inesperada', () async {
      adapter.enqueueResponse(body: {'slug': 42});

      final result = await get(
        (data) => (data! as Map<String, Object?>)['slug']! as String,
      );

      expect(result, isA<Failure<String>>());
      final failure = (result as Failure<String>).failure;
      expect(failure, isA<UnexpectedFailure>());
      expect(failure.code, HttpFailureCode.unexpected);
      expect(failure.message, 'Algo deu errado. Tente novamente.');
    });

    test('conexão recusada vira falha de rede', () async {
      adapter.enqueueError(DioExceptionType.connectionError);

      final result = await get((data) => data);

      final failure = (result as Failure<Object?>).failure;
      expect(failure, isA<NetworkFailure>());
      expect(failure.code, HttpFailureCode.noConnection);
    });

    test('400 vira recusa com os códigos do corpo', () async {
      adapter.enqueueResponse(
        statusCode: 400,
        body: {
          'statusCode': 400,
          'error': 'Bad Request',
          'message': [
            'CART_ITEMS_LIMIT_EXCEEDED',
            'CART_ITEM_QUANTITY_EXCEEDED',
          ],
        },
      );

      final result = await get((data) => data);

      final failure = (result as Failure<Object?>).failure;
      expect(failure, isA<BackendRejectionFailure>());
      final rejection = failure as BackendRejectionFailure;
      expect(rejection.statusCode, 400);
      expect(rejection.codes, [
        'CART_ITEMS_LIMIT_EXCEEDED',
        'CART_ITEM_QUANTITY_EXCEEDED',
      ]);
    });

    test('204 entrega null ao parse', () async {
      adapter.enqueueResponse(statusCode: 204);
      final received = <Object?>['não chamado'];

      final result = await get((data) {
        received
          ..clear()
          ..add(data);
        return true;
      });

      expect(result, isA<Ok<bool>>());
      expect(received, [null]);
    });
  });
}
