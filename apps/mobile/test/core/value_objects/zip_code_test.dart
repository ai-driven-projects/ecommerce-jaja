import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/zip_code.dart';

ZipCode zipCode(String input) => switch (ZipCode.create(input)) {
  Ok(:final value) => value,
  Failure(:final failure) => throw StateError(failure.message),
};

void expectInvalid(String input) {
  switch (ZipCode.create(input)) {
    case Ok():
      fail('esperava falha para "$input"');
    case Failure(:final failure):
      expect(failure, isA<ValidationFailure>());
      expect(failure.code, ZipCodeCode.invalid);
      expect(failure.message, 'CEP inválido.');
  }
}

void main() {
  group('ZipCode', () {
    test('com e sem hífen guarda os 8 dígitos e formata', () {
      expect(zipCode(' 60150-160 ').value, '60150160');
      expect(zipCode('60150160').value, '60150160');
      expect(zipCode('60150160').formatted, '60150-160');
    });

    test('hífen fora do lugar, tamanho errado ou vazio é inválido', () {
      expectInvalid('6015-0160');
      expectInvalid('6015016');
      expectInvalid('601501600');
      expectInvalid('');
    });
  });
}
