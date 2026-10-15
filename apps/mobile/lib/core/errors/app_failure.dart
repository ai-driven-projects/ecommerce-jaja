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

enum EmailCode { invalid }

enum PersonNameCode { tooShort, tooLong, surnameMissing }

/// Códigos `CPF_*` de `packages/shared/src/vo/cpf.vo.ts`.
enum CpfCode {
  invalidFormat,
  invalidLength,
  repeatedSequence,
  invalidCheckDigit,
}

/// Códigos `PHONE_*` de `packages/shared/src/vo/phone.vo.ts`.
enum PhoneCode { invalidFormat, invalidLength }

enum ZipCodeCode { invalid }

enum StateCodeCode { invalid }

/// Códigos `TEXT_TOO_SHORT`/`TEXT_TOO_LONG` de
/// `packages/shared/src/vo/text.vo.ts`.
enum TextCode { tooShort, tooLong }

/// `mismatch`: a confirmação do cadastro difere da senha (validada no
/// `RegisterViewModel`, não num value object).
enum PasswordCode { tooWeak, mismatch }

enum ConfigurationCode { missingApiUrl, invalidApiUrl }

/// Códigos das falhas de requisição HTTP, atribuídos por `mapHttpFailure` em
/// `lib/infra/http`.
enum HttpFailureCode {
  noConnection,
  timeout,
  sessionExpired,
  notFound,
  rejected,
  server,
  unexpected,
}
