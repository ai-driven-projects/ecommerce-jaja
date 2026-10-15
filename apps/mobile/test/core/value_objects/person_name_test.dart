import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/person_name.dart';

PersonName personName(String input) => switch (PersonName.create(input)) {
  Ok(:final value) => value,
  Failure(:final failure) => throw StateError(failure.message),
};

void expectFailure(String input, PersonNameCode code, String message) {
  switch (PersonName.create(input)) {
    case Ok():
      fail('esperava falha para "$input"');
    case Failure(:final failure):
      expect(failure, isA<ValidationFailure>());
      expect(failure.code, code);
      expect(failure.message, message);
  }
}

const surnameMissing = 'Informe nome e sobrenome.';
const tooShort = 'O nome é curto demais.';
const tooLong = 'O nome é longo demais.';

void main() {
  group('PersonName', () {
    test('nome e sobrenome válidos, aparados', () {
      expect(personName('Ana Souza').value, 'Ana Souza');
      expect(personName('  Ana Souza  ').value, 'Ana Souza');
    });

    test('acentos, apóstrofo e hífen são aceitos', () {
      expect(personName("João D'Ávila-Neto").value, "João D'Ávila-Neto");
    });

    test('uma palavra só pede o sobrenome', () {
      expectFailure('Ana', PersonNameCode.surnameMissing, surnameMissing);
    });

    test('caractere fora da lista pede o sobrenome, como no TS', () {
      expectFailure('Ana 33', PersonNameCode.surnameMissing, surnameMissing);
      expectFailure('Ana S0uza', PersonNameCode.surnameMissing, surnameMissing);
    });

    test('última palavra de um caractere é curta, antes da lista', () {
      // Mesma ordem do TS: o tamanho das palavras é conferido antes dos
      // caracteres, então `Ana 3` cai em "curto", não em "sem sobrenome".
      expectFailure('Ana 3', PersonNameCode.tooShort, tooShort);
    });

    test('primeira palavra de uma letra ou menos de 3 caracteres é curto', () {
      expectFailure('A Souza', PersonNameCode.tooShort, tooShort);
      expectFailure('Al', PersonNameCode.tooShort, tooShort);
      expectFailure('', PersonNameCode.tooShort, tooShort);
    });

    test('mais de 50 caracteres é longo; 50 é aceito', () {
      final fifty = 'Ana ${'S' * 46}';
      expect(fifty.length, 50);
      expect(personName(fifty).value, fifty);

      final fiftyOne = 'Ana ${'S' * 47}';
      expect(fiftyOne.length, 51);
      expectFailure(fiftyOne, PersonNameCode.tooLong, tooLong);
    });

    test('maxLength é 50', () {
      expect(PersonName.maxLength, 50);
    });

    test('igualdade por valor aparado', () {
      expect(personName('Ana Souza'), personName(' Ana Souza '));
      expect(
        personName('Ana Souza').hashCode,
        personName('Ana Souza ').hashCode,
      );
      expect(personName('Ana Souza'), isNot(personName('Bia Souza')));
    });
  });
}
