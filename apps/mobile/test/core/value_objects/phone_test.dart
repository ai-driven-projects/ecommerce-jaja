import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/phone.dart';

Phone phone(String input) => switch (Phone.create(input)) {
  Ok(:final value) => value,
  Failure(:final failure) => throw StateError(failure.message),
};

void expectInvalid(String input, PhoneCode code) {
  switch (Phone.create(input)) {
    case Ok():
      fail('esperava falha para "$input"');
    case Failure(:final failure):
      expect(failure, isA<ValidationFailure>());
      expect(failure.code, code);
      expect(failure.message, 'Telefone inválido.');
  }
}

void main() {
  group('Phone', () {
    test('com máscara guarda só os dígitos', () {
      expect(phone(' (85) 99999-8888 ').value, '85999998888');
    });

    test('aceita de 8 a 15 dígitos, com + no início', () {
      expect(phone('3333-4444').value, '33334444');
      expect(phone('+55 85 99999-8888').value, '5585999998888');
      expect(phone('123456789012345').value, '123456789012345');
    });

    test('7 e 16 dígitos são inválidos', () {
      expectInvalid('1234567', PhoneCode.invalidLength);
      expectInvalid('1234567890123456', PhoneCode.invalidLength);
    });

    test('letra ou vazio é inválido', () {
      expectInvalid('(85) 9999A-8888', PhoneCode.invalidFormat);
      expectInvalid('', PhoneCode.invalidFormat);
    });
  });
}
