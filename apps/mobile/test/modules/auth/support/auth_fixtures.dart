import 'package:mobile/modules/auth/model/auth_user_entity.dart';

/// Cliente comum dos testes de sessão.
const ana = AuthUser(
  id: '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e01',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  isAdmin: false,
);

/// Administrador: a aba Conta mostra "Administrador" no lugar do e-mail.
const admin = AuthUser(
  id: '7c1e2d3f-4a5b-4c6d-8e9f-0a1b2c3d4e02',
  name: 'Bruno Lima',
  email: 'admin@jaja.com.br',
  isAdmin: true,
);
