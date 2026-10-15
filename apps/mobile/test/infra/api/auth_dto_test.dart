import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/infra/api/auth_dto.dart';

import '../../modules/auth/support/auth_fixtures.dart';
import 'support/auth_json.dart';

/// `FormatException` cuja mensagem cita o [field].
Matcher throwsFormatOn(String field) => throwsA(
  isA<FormatException>().having((e) => e.message, 'message', contains(field)),
);

/// Simula o corpo como o `dio` o entrega, já decodificado do texto.
Object? decoded(Object? json) => jsonDecode(jsonEncode(json));

void main() {
  group('parseLoginResponse', () {
    test('lê o token e o usuário do login', () {
      final session = parseLoginResponse(decoded(loginResponseJson));

      expect(session.token, anaToken);
      expect(session.user, ana);
    });

    test('token vazio lança com o campo', () {
      expect(
        () => parseLoginResponse(loginWithEmptyTokenJson),
        throwsFormatOn('token'),
      );
    });

    test('sem usuário ou corpo que não é objeto lança', () {
      expect(
        () => parseLoginResponse(loginWithoutUserJson),
        throwsFormatOn('user'),
      );
      expect(() => parseLoginResponse(null), throwsA(isA<FormatException>()));
      expect(() => parseLoginResponse('ok'), throwsA(isA<FormatException>()));
    });
  });

  group('parseAuthUser', () {
    test('lê o /auth/me sem avatarUrl', () {
      expect(parseAuthUser(decoded(anaMeJson)), ana);
    });

    test('admin verdadeiro vira isAdmin', () {
      expect(parseAuthUser({...anaMeJson, 'admin': true}).isAdmin, isTrue);
    });

    test('campos a mais são ignorados', () {
      expect(parseAuthUser(anaMeWithExtraJson), ana);
    });

    test('admin ausente ou em texto lança com o campo', () {
      expect(
        () => parseAuthUser(userWithoutAdminJson),
        throwsFormatOn('admin'),
      );
      expect(
        () => parseAuthUser(userWithTextAdminJson),
        throwsFormatOn('admin'),
      );
    });

    test('email de outro tipo lança com o campo', () {
      expect(
        () => parseAuthUser({...anaMeJson, 'email': 42}),
        throwsFormatOn('email'),
      );
    });
  });

  group('StoredSession', () {
    test('encode e decodeStoredSession vão e voltam', () {
      const session = StoredSession(token: anaToken, user: admin);

      expect(decodeStoredSession(session.encode()), session);
    });

    test('encode grava o formato do cookie do web', () {
      const session = StoredSession(token: anaToken, user: ana);

      expect(jsonDecode(session.encode()), storedAnaSessionJson);
    });

    test('texto ilegível ou fora do formato lança FormatException', () {
      expect(
        () => decodeStoredSession('{token'),
        throwsA(isA<FormatException>()),
      );
      expect(() => decodeStoredSession('[]'), throwsA(isA<FormatException>()));
      expect(
        () => decodeStoredSession(jsonEncode({'token': anaToken})),
        throwsFormatOn('user'),
      );
    });
  });
}
