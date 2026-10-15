import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/money.dart';

/// `Money` a partir de centavos válidos, para os testes de UI.
Money money(int cents) => switch (Money.fromCents(cents)) {
  Ok(:final value) => value,
  Failure(:final failure) => throw StateError(failure.message),
};
