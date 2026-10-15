sealed class AppFailure {
  const AppFailure({required this.message, required this.code});

  /// Sempre texto literal em português, nunca `error.toString()` nem stack
  /// trace, que vazariam detalhes internos para a tela.
  final String message;

  final Enum code;
}

final class ValidationFailure extends AppFailure {
  const ValidationFailure({required super.message, required super.code});
}

final class NetworkFailure extends AppFailure {
  const NetworkFailure({required super.message, required super.code});
}

final class ConfigurationFailure extends AppFailure {
  const ConfigurationFailure({required super.message, required super.code});
}

/// Sessão ausente ou expirada (401).
final class SessionFailure extends AppFailure {
  const SessionFailure({required super.message, required super.code});
}

/// Recusa 4xx do backend; [codes] vem do `message` do `ApiErrorResponse`, na
/// ordem em que o backend enviou.
final class BackendRejectionFailure extends AppFailure {
  const BackendRejectionFailure({
    required super.message,
    required super.code,
    required this.statusCode,
    required this.codes,
  });

  final int statusCode;
  final List<String> codes;
}

final class NotFoundFailure extends AppFailure {
  const NotFoundFailure({required super.message, required super.code});
}

/// Erro 5xx do backend.
final class ServerFailure extends AppFailure {
  const ServerFailure({required super.message, required super.code});
}

final class UnexpectedFailure extends AppFailure {
  const UnexpectedFailure({required super.message, required super.code});
}

enum GenericFailureCode { unspecified }

enum MoneyCode { negativeCents }

enum ConfigurationCode { missingApiUrl, invalidApiUrl }
