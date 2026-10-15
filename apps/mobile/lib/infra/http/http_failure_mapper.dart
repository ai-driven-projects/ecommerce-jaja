import 'package:dio/dio.dart';

import '../../core/errors/app_failure.dart';

const _networkMessage =
    'Não foi possível falar com o servidor. Tente novamente.';
const _unexpectedMessage = 'Algo deu errado. Tente novamente.';

/// Traduz qualquer falha de requisição do `dio` numa [AppFailure] tipada.
///
/// As mensagens são sempre literais: nunca citam códigos do backend nem textos
/// de exceção. Quem precisa de texto específico olha
/// [BackendRejectionFailure.codes].
AppFailure mapHttpFailure(DioException exception) {
  return switch (exception.type) {
    DioExceptionType.connectionTimeout ||
    DioExceptionType.sendTimeout ||
    DioExceptionType.receiveTimeout ||
    DioExceptionType.transformTimeout => const NetworkFailure(
      message: _networkMessage,
      code: HttpFailureCode.timeout,
    ),
    DioExceptionType.connectionError ||
    DioExceptionType.badCertificate => const NetworkFailure(
      message: _networkMessage,
      code: HttpFailureCode.noConnection,
    ),
    DioExceptionType.badResponse => _mapResponse(exception.response),
    DioExceptionType.cancel || DioExceptionType.unknown => _unexpected,
  };
}

const _unexpected = UnexpectedFailure(
  message: _unexpectedMessage,
  code: HttpFailureCode.unexpected,
);

AppFailure _mapResponse(Response<Object?>? response) {
  final statusCode = response?.statusCode;
  if (statusCode == null) return _unexpected;
  if (statusCode == 401) {
    return const SessionFailure(
      message: 'Sua sessão expirou. Entre de novo.',
      code: HttpFailureCode.sessionExpired,
    );
  }
  if (statusCode == 404) {
    return const NotFoundFailure(
      message: 'Não encontramos o que você procurou.',
      code: HttpFailureCode.notFound,
    );
  }
  if (statusCode >= 400 && statusCode < 500) {
    return BackendRejectionFailure(
      message: 'Não foi possível concluir. Tente novamente.',
      code: HttpFailureCode.rejected,
      statusCode: statusCode,
      codes: _extractCodes(response?.data),
    );
  }
  if (statusCode >= 500) {
    return const ServerFailure(
      message:
          'O servidor está indisponível no momento. Tente novamente em instantes.',
      code: HttpFailureCode.server,
    );
  }
  return _unexpected;
}

/// Códigos de negócio do campo `message` do `ApiErrorResponse`, na ordem
/// recebida. Corpo ausente, texto (HTML) ou fora do formato dá lista vazia.
List<String> _extractCodes(Object? data) {
  if (data is! Map) return const [];
  return switch (data['message']) {
    final List<Object?> items => List.unmodifiable(items.whereType<String>()),
    final String code when code.isNotEmpty => List.unmodifiable([code]),
    _ => const [],
  };
}
