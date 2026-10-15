import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_user_entity.freezed.dart';

/// Usuário autenticado como `POST /auth/login` e `GET /auth/me` o devolvem
/// (`UserDTO` em `modules/auth/src/user/dto`, sem o `avatarUrl`, que o app não
/// usa e o `/auth/me` nem envia). [isAdmin] é o `admin` da API.
@freezed
abstract class AuthUser with _$AuthUser {
  const factory AuthUser({
    required String id,
    required String name,
    required String email,
    required bool isAdmin,
  }) = _AuthUser;

  const AuthUser._();

  static final _spaces = RegExp(r'\s+');

  /// Primeira palavra do nome aparado, para as saudações ("Olá, Ana"); o nome
  /// inteiro quando não há palavra. Mesma regra de `firstNameOf` em
  /// `apps/frontend/src/modules/auth/data/first-name.util.ts`.
  String get firstName {
    final first = name.trim().split(_spaces).first;
    return first.isEmpty ? name : first;
  }
}
