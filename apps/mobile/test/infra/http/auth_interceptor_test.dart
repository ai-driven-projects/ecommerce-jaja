import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/http/api_client.dart';
import 'package:mobile/infra/http/auth_interceptor.dart';
import 'package:mobile/infra/http/run_request.dart';

import 'support/fake_http_client_adapter.dart';

void main() {
  late FakeHttpClientAdapter adapter;
  late Dio dio;
  late String? token;
  late int unauthorizedCalls;

  setUp(() {
    adapter = FakeHttpClientAdapter();
    token = null;
    unauthorizedCalls = 0;
    dio = createApiClient(Uri.parse('http://localhost:4000'))
      ..httpClientAdapter = adapter
      ..interceptors.add(
        AuthInterceptor(
          readToken: () => token,
          onUnauthorized: () => unauthorizedCalls++,
        ),
      );
  });

  Future<Result<void>> getStores({Map<String, Object?>? headers}) => runRequest(
    () => dio.get<Object?>(
      '/storefront/stores',
      options: Options(headers: headers),
    ),
    (_) {},
  );

  Object? authorizationOf(RequestOptions request) =>
      request.headers['Authorization'];

  group('AuthInterceptor', () {
    test('com sessão, a requisição sai com Authorization: Bearer', () async {
      token = 'abc';
      adapter.enqueueResponse(body: []);

      await getStores();

      expect(authorizationOf(adapter.requests.single), 'Bearer abc');
    });

    test('sem sessão, a requisição sai sem Authorization', () async {
      adapter.enqueueResponse(body: []);

      await getStores();

      expect(
        adapter.requests.single.headers.keys.map((key) => key.toLowerCase()),
        isNot(contains('authorization')),
      );
    });

    test('mantém o Authorization próprio da requisição', () async {
      token = 'abc';
      adapter.enqueueResponse(body: []);

      await getStores(headers: {'Authorization': 'Bearer guardado'});

      expect(authorizationOf(adapter.requests.single), 'Bearer guardado');
    });

    test('o token não vai na URL nem na query', () async {
      token = 'abc';
      adapter.enqueueResponse(body: []);

      await getStores();

      expect(adapter.requests.single.uri.toString(), isNot(contains('abc')));
    });

    test('401 com o token atual encerra a sessão uma vez e a chamada termina '
        'em falha de sessão', () async {
      token = 'abc';
      adapter.enqueueResponse(statusCode: 401);

      final result = await getStores();

      expect(unauthorizedCalls, 1);
      expect(result, isA<Failure<void>>());
      final failure = (result as Failure<void>).failure;
      expect(failure, isA<SessionFailure>());
      expect(failure.message, 'Sua sessão expirou. Entre de novo.');
    });

    test('401 sem token (senha errada no login) não mexe na sessão', () async {
      adapter.enqueueResponse(statusCode: 401);

      final result = await runRequest(
        () => dio.post<Object?>(
          '/auth/login',
          data: {'email': 'ana@exemplo.com', 'password': '#Errada123'},
        ),
        (_) {},
      );

      expect(unauthorizedCalls, 0);
      expect((result as Failure<void>).failure, isA<SessionFailure>());
    });

    test('401 de uma requisição com outro token não mexe na sessão', () async {
      token = 'abc';
      adapter.enqueueResponse(statusCode: 401);

      final result = await getStores(
        headers: {'Authorization': 'Bearer guardado'},
      );

      expect(unauthorizedCalls, 0);
      expect((result as Failure<void>).failure, isA<SessionFailure>());
    });

    test('outros erros com o token atual não mexem na sessão', () async {
      token = 'abc';
      adapter
        ..enqueueResponse(statusCode: 403)
        ..enqueueResponse(statusCode: 500)
        ..enqueueError(DioExceptionType.connectionError);

      await getStores();
      await getStores();
      await getStores();

      expect(unauthorizedCalls, 0);
    });
  });
}
