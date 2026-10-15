import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/http/api_client.dart';

import 'support/fake_http_client_adapter.dart';

void main() {
  final baseUrl = Uri.parse('http://10.0.2.2:4000');

  group('createApiClient', () {
    test('usa o endereço base dado', () {
      final dio = createApiClient(baseUrl);

      expect(dio.options.baseUrl, 'http://10.0.2.2:4000');
    });

    test('desiste da conexão em 5 s e da resposta em 10 s', () {
      final dio = createApiClient(baseUrl);

      expect(dio.options.connectTimeout, const Duration(seconds: 5));
      expect(dio.options.receiveTimeout, const Duration(seconds: 10));
    });

    test('troca JSON e só aceita 2xx como sucesso', () {
      final options = createApiClient(baseUrl).options;

      expect(options.contentType, Headers.jsonContentType);
      expect(options.responseType, ResponseType.json);
      expect(options.validateStatus(200), isTrue);
      expect(options.validateStatus(204), isTrue);
      expect(options.validateStatus(400), isFalse);
      expect(options.validateStatus(500), isFalse);
    });

    test('GET relativo sai para o endereço base com Accept JSON', () async {
      final adapter = FakeHttpClientAdapter()
        ..enqueueResponse(body: const <Object>[]);
      final dio = createApiClient(baseUrl)..httpClientAdapter = adapter;

      final response = await dio.get<Object?>('/storefront/stores');

      expect(adapter.requests, hasLength(1));
      final request = adapter.requests.single;
      expect(request.method, 'GET');
      expect(request.uri.toString(), 'http://10.0.2.2:4000/storefront/stores');
      expect(request.headers[Headers.acceptHeader], 'application/json');
      expect(response.statusCode, 200);
      expect(response.data, isEmpty);
    });
  });
}
