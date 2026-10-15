import 'package:flutter_test/flutter_test.dart';

import '../support/auth_fixtures.dart';

void main() {
  group('AuthUser', () {
    test('firstName é a primeira palavra do nome aparado', () {
      expect(ana.copyWith(name: '  Ana  Souza ').firstName, 'Ana');
      expect(ana.firstName, 'Ana');
    });

    test('nome de uma palavra é o próprio primeiro nome', () {
      expect(ana.copyWith(name: 'Ana').firstName, 'Ana');
    });

    test('nome só de espaços devolve o nome como veio', () {
      expect(ana.copyWith(name: '  ').firstName, '  ');
    });

    test('é igual por valor', () {
      expect(ana.copyWith(), ana);
      expect(ana.copyWith().hashCode, ana.hashCode);
      expect(ana.copyWith(isAdmin: true), isNot(ana));
      expect(ana, isNot(admin));
    });
  });
}
