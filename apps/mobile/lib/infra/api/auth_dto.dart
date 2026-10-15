import 'dart:convert';

import '../../modules/auth/model/auth_user_entity.dart';

/// Sessão como o app a guarda: o token JWT e o usuário que ele representa.
/// Mesmo formato do `AuthSession` do cookie do web
/// (`apps/frontend/src/modules/auth/data/auth.types.ts`).
final class StoredSession {
  const StoredSession({required this.token, required this.user});

  final String token;
  final AuthUser user;

  /// `{"token": …, "user": {"id", "name", "email", "admin"}}`, lido de volta
  /// por [decodeStoredSession].
  String encode() => jsonEncode({
    'token': token,
    'user': {
      'id': user.id,
      'name': user.name,
      'email': user.email,
      'admin': user.isAdmin,
    },
  });

  @override
  bool operator ==(Object other) =>
      other is StoredSession && other.token == token && other.user == user;

  @override
  int get hashCode => Object.hash(token, user);
}

// DTOs de `POST /auth/login` (`LoginResponse` do `AuthController`) e
// `GET /auth/me` (`mapPayloadToAuthenticatedUser`), escritos à mão. Campo
// ausente ou de outro tipo lança `FormatException` com o nome do campo, que o
// `runRequest` converte em falha inesperada. Campos a mais (o `avatarUrl` do
// login, inclusive) são ignorados.

/// Usuário de `GET /auth/me` ou do `user` do login.
AuthUser parseAuthUser(Object? data) {
  final json = _object(data, 'user');
  return AuthUser(
    id: _string(json, 'id'),
    name: _string(json, 'name'),
    email: _string(json, 'email'),
    isAdmin: _bool(json, 'admin'),
  );
}

/// Corpo de `POST /auth/login`. Token vazio também é erro.
StoredSession parseLoginResponse(Object? data) {
  final json = _object(data, 'corpo');
  final token = _string(json, 'token');
  if (token.isEmpty) throw const FormatException('Campo "token" vazio.');
  return StoredSession(token: token, user: parseAuthUser(json['user']));
}

/// Lê o texto gravado por [StoredSession.encode]. Texto ilegível ou fora do
/// formato lança `FormatException`.
StoredSession decodeStoredSession(String text) =>
    parseLoginResponse(jsonDecode(text));

Map<String, Object?> _object(Object? value, String field) {
  if (value is Map<String, Object?>) return value;
  throw FormatException('Campo "$field" não é um objeto.');
}

String _string(Map<String, Object?> json, String field) {
  final value = json[field];
  if (value is String) return value;
  throw FormatException('Campo "$field" ausente ou não é texto.');
}

bool _bool(Map<String, Object?> json, String field) {
  final value = json[field];
  if (value is bool) return value;
  throw FormatException('Campo "$field" ausente ou não é booleano.');
}
