import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/cpf.dart';

Cpf cpf(String input) => switch (Cpf.create(input)) {
  Ok(:final value) => value,
  Failure(:final failure) => throw StateError(failure.message),
};

void expectInvalid(String input, CpfCode code) {
  switch (Cpf.create(input)) {
    case Ok():
      fail('esperava falha para "$input"');
    case Failure(:final failure):
      expect(failure, isA<ValidationFailure>());
      expect(failure.code, code);
      expect(failure.message, 'CPF inválido.');
  }
}

void main() {
  group('Cpf', () {
    test('com máscara guarda os dígitos e formata de volta', () {
      final value = cpf(' 529.982.247-25 ');

      expect(value.value, '52998224725');
      expect(value.formatted, '529.982.247-25');
    });

    test('só com dígitos também é aceito', () {
      final value = cpf('52998224725');

      expect(value.value, '52998224725');
      expect(value.formatted, '529.982.247-25');
    });

    test('dígito verificador errado é inválido', () {
      expectInvalid('529.982.247-24', CpfCode.invalidCheckDigit);
    });

    test('10 dígitos é inválido', () {
      expectInvalid('5299822472', CpfCode.invalidLength);
    });

    test('sequência repetida é inválida', () {
      expectInvalid('111.111.111-11', CpfCode.repeatedSequence);
    });

    test('letra ou vazio é inválido', () {
      expectInvalid('529.982.247-2A', CpfCode.invalidFormat);
      expectInvalid('', CpfCode.invalidFormat);
    });

    test('igualdade por dígitos', () {
      expect(cpf('529.982.247-25'), cpf('52998224725'));
      expect(cpf('529.982.247-25').hashCode, cpf('52998224725').hashCode);
    });
  });
}
