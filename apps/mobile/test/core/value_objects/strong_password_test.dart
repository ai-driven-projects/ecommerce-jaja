import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/core/value_objects/strong_password.dart';

StrongPassword password(String input) => switch (StrongPassword.create(input)) {
  Ok(:final value) => value,
  Failure(:final failure) => throw StateError(failure.message),
};

const weakMessage =
    'A senha precisa ter ao menos 8 caracteres, com maiúscula, minúscula, '
    'número e símbolo.';

void expectWeak(String input) {
  switch (StrongPassword.create(input)) {
    case Ok():
      fail('esperava falha para "$input"');
    case Failure(:final failure):
      expect(failure, isA<ValidationFailure>());
      expect(failure.code, PasswordCode.tooWeak);
      expect(failure.message, weakMessage);
  }
}

void main() {
  group('StrongPassword', () {
    test('maiúscula, minúscula, número e símbolo com 8 caracteres', () {
      expect(password('#Senha123').value, '#Senha123');
    });

    test('falta de qualquer exigência dá a mensagem de senha forte', () {
      expectWeak('Senha1234');
      expectWeak('#senha123');
      expectWeak('#SENHA123');
      expectWeak('#Senhaaaa');
      expectWeak('#Se1');
      expectWeak('');
    });

    test('espaços não são aparados e contam como símbolo', () {
      expect(password(' Senha123 ').value, ' Senha123 ');
    });

    test('igualdade por valor e toString sem a senha', () {
      expect(password('#Senha123'), password('#Senha123'));
      expect(password('#Senha123').hashCode, password('#Senha123').hashCode);
      expect(password('#Senha123'), isNot(password('#Senha124')));
      expect(password('#Senha123').toString(), isNot(contains('Senha123')));
    });
  });
}
