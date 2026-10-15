import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/bounded_text.dart';

Result<BoundedText> create(String input) =>
    BoundedText.create(input, min: 2, max: 5);

void expectInvalid(String input, TextCode code, String message) {
  switch (create(input)) {
    case Ok():
      fail('esperava falha para "$input"');
    case Failure(:final failure):
      expect(failure, isA<ValidationFailure>());
      expect(failure.code, code);
      expect(failure.message, message);
  }
}

String valueOf(String input) => switch (create(input)) {
  Ok(:final value) => value.value,
  Failure(:final failure) => throw StateError(failure.message),
};

void main() {
  group('BoundedText', () {
    test('apara e aceita os limites exatos', () {
      expect(valueOf('  ab  '), 'ab');
      expect(valueOf(' abcde '), 'abcde');
    });

    test('curto demais depois de aparar', () {
      expectInvalid(
        ' a   ',
        TextCode.tooShort,
        'O texto não atingiu o tamanho mínimo permitido.',
      );
    });

    test('longo demais', () {
      expectInvalid(
        'abcdef',
        TextCode.tooLong,
        'O texto passou do tamanho máximo permitido.',
      );
    });
  });
}
