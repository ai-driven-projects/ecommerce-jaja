import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';

/// Mensagem da falha de validação de um campo, ou `null` se válido.
String? validationMessage(Result<Object> result) => switch (result) {
  Ok() => null,
  Failure(:final failure) => failure.message,
};

/// Mensagem de formulário do resultado de um envio: nada no sucesso, durante
/// o envio (o `Command` limpa o resultado) ou na falha de validação, que fica
/// nos campos.
String? formErrorMessage(Result<Object>? result) => switch (result) {
  Failure(:final failure) when failure is! ValidationFailure => failure.message,
  _ => null,
};
