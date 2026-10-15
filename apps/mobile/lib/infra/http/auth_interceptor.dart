import 'package:dio/dio.dart';

/// Envia o token da sessão como `Authorization: Bearer` e encerra a sessão
/// quando o servidor recusa esse mesmo token (`401`).
///
/// Recebe fechamentos, não a sessão: a DI os resolve no `getIt` na hora da
/// requisição, sem ciclo entre o `Dio` e o repositório de sessão.
class AuthInterceptor extends Interceptor {
  AuthInterceptor({required this.readToken, required this.onUnauthorized});

  /// Token da sessão ativa, ou `null` sem sessão.
  final String? Function() readToken;

  /// Chamado no `401` de uma requisição que levou o token atual.
  final void Function() onUnauthorized;

  static const String _header = 'Authorization';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = readToken();
    // Cabeçalho próprio da requisição (o `/auth/me` do `restore`) é mantido.
    if (token != null && !_hasAuthorization(options)) {
      options.headers[_header] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final token = readToken();
    // Só o token atual: o login (sem token) e o `/auth/me` do `restore`
    // (token fora da memória) não encerram nada. O erro segue sempre, para o
    // `runRequest` devolver a falha de sessão.
    if (err.response?.statusCode == 401 &&
        token != null &&
        _authorization(err.requestOptions) == 'Bearer $token') {
      onUnauthorized();
    }
    handler.next(err);
  }

  static bool _hasAuthorization(RequestOptions options) =>
      _authorization(options) != null;

  static Object? _authorization(RequestOptions options) {
    for (final entry in options.headers.entries) {
      if (entry.key.toLowerCase() == _header.toLowerCase()) return entry.value;
    }
    return null;
  }
}
