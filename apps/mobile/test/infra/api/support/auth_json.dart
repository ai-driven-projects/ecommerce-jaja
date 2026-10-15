// JSON das rotas de acesso para a cliente `ana` de
// `test/modules/auth/support/auth_fixtures.dart`, para os DTOs serem
// comparáveis às fixtures.

/// Token de exemplo (o app não decodifica o JWT; a validade é do servidor).
const anaToken = 'eyJhbGciOiJIUzI1NiJ9.ana.assinatura';

/// `UserDTO` como `POST /auth/login` o devolve, com o `avatarUrl`.
const anaUserJson = <String, Object?>{
  'id': '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e01',
  'name': 'Ana Souza',
  'email': 'ana@exemplo.com',
  'avatarUrl': null,
  'admin': false,
};

/// Corpo de `POST /auth/login` (`LoginResponse` do `AuthController`).
const loginResponseJson = <String, Object?>{
  'token': anaToken,
  'user': anaUserJson,
};

/// Corpo de `GET /auth/me`: `mapPayloadToAuthenticatedUser`, sem `avatarUrl`.
const anaMeJson = <String, Object?>{
  'id': '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e01',
  'name': 'Ana Souza',
  'email': 'ana@exemplo.com',
  'admin': false,
};

/// `/auth/me` com um campo que o app não conhece.
const anaMeWithExtraJson = <String, Object?>{...anaMeJson, 'role': 'customer'};

/// Usuário sem o `admin`.
final userWithoutAdminJson = Map<String, Object?>.of(anaMeJson)
  ..remove('admin');

/// Usuário com `admin` em texto.
const userWithTextAdminJson = <String, Object?>{
  'id': '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e01',
  'name': 'Ana Souza',
  'email': 'ana@exemplo.com',
  'admin': 'false',
};

/// Login com token vazio.
const loginWithEmptyTokenJson = <String, Object?>{
  'token': '',
  'user': anaUserJson,
};

/// Login sem o usuário.
const loginWithoutUserJson = <String, Object?>{'token': anaToken};

/// Sessão como o app a guarda no armazenamento seguro (o mesmo `AuthSession`
/// do cookie do web).
const storedAnaSessionJson = <String, Object?>{
  'token': anaToken,
  'user': anaMeJson,
};
