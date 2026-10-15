import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/state_code.dart';

void expectInvalid(String input) {
  switch (StateCode.create(input)) {
    case Ok():
      fail('esperava falha para "$input"');
    case Failure(:final failure):
      expect(failure, isA<ValidationFailure>());
      expect(failure.code, StateCodeCode.invalid);
      expect(failure.message, 'UF inválida.');
  }
}

void main() {
  group('StateCode', () {
    test('apara e põe em maiúsculas', () {
      switch (StateCode.create(' sp ')) {
        case Ok(:final value):
          expect(value.value, 'SP');
        case Failure(:final failure):
          fail(failure.message);
      }
    });

    test('as 27 siglas são aceitas', () {
      expect(StateCode.codes, hasLength(27));
      for (final code in StateCode.codes) {
        expect(StateCode.create(code), isA<Ok<StateCode>>());
      }
    });

    test('sigla fora da lista ou vazia é inválida', () {
      expectInvalid('XX');
      expectInvalid('SPA');
      expectInvalid('');
    });
  });
}
