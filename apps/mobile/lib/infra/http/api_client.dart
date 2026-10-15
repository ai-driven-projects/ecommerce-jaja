import 'package:dio/dio.dart';

/// Cliente HTTP do app, relativo ao endereço resolvido de `API_URL`.
///
/// Só 2xx é sucesso (`validateStatus` padrão); o resto vira `DioException` e
/// é traduzido por `mapHttpFailure`. Sem `sendTimeout`: o `dio` reclama dele em
/// requisições sem corpo.
Dio createApiClient(Uri baseUrl) {
  return Dio(
    BaseOptions(
      baseUrl: baseUrl.toString(),
      connectTimeout: const Duration(seconds: 5),
      receiveTimeout: const Duration(seconds: 10),
      headers: {Headers.acceptHeader: Headers.jsonContentType},
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
    ),
  );
}
