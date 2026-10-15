import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/email.dart';

Email email(String input) => switch (Email.create(input)) {
  Ok(:final value) => value,
  Failure(:final failure) => throw StateError(failure.message),
};

void expectInvalid(String input) {
  switch (Email.create(input)) {
    case Ok():
      fail('esperava falha para "$input"');
    case Failure(:final failure):
      expect(failure, isA<ValidationFailure>());
      expect(failure.code, EmailCode.invalid);
      expect(failure.message, 'E-mail inválido.');
  }
}

void main() {
  group('Email', () {
    test('apara e põe em minúsculas', () {
      expect(email(' Ana@Exemplo.COM ').value, 'ana@exemplo.com');
    });

    test('sem domínio, com espaço no meio ou vazio é inválido', () {
      expectInvalid('ana@');
      expectInvalid('ana @x.com');
      expectInvalid('');
      expectInvalid('   ');
      expectInvalid('ana@exemplo');
    });

    test('igualdade e hashCode por valor normalizado', () {
      expect(email('ana@exemplo.com'), email(' ANA@exemplo.com'));
      expect(
        email('ana@exemplo.com').hashCode,
        email('Ana@Exemplo.com').hashCode,
      );
      expect(email('ana@exemplo.com'), isNot(email('bia@exemplo.com')));
    });
  });
}
