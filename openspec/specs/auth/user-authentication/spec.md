# Autenticação de Usuário (User Authentication) Specification

## Purpose

Define como um usuário se autentica no Jaja por email e senha, o que o token de acesso carrega, como credenciais inválidas são tratadas e como o usuário autenticado (com a flag de administrador) fica disponível nas requisições protegidas.

## Requirements

### Requirement: Login por email e senha
O sistema SHALL expor um endpoint público `POST /auth/login` que recebe `email` e `password`. Em sucesso MUST responder `200` com `{ token, user }`, onde `user` contém `id`, `name`, `email`, `avatarUrl` e `admin`. A resposta MUST NOT conter a senha nem o hash. Email malformado MUST responder `400`.

#### Scenario: Login válido de administrador
- **WHEN** um cliente envia `{ email: "usuario@formacao.dev", password: "#Senha123" }` após o seed
- **THEN** o sistema responde `200` com um `token` e `user.admin = true`

#### Scenario: Login válido de usuário comum
- **WHEN** um cliente envia as credenciais válidas de um usuário não administrador
- **THEN** o sistema responde `200` com um `token` e `user.admin = false`

### Requirement: Credenciais inválidas sem revelar o motivo
Email inexistente, usuário sem senha cadastrada ou senha incorreta MUST resultar na mesma resposta `401` com o código `INVALID_CREDENTIALS`, sem indicar qual dos fatores falhou.

#### Scenario: Senha incorreta
- **WHEN** um cliente envia um email cadastrado com uma senha errada
- **THEN** o sistema responde `401` com `INVALID_CREDENTIALS`

#### Scenario: Email inexistente
- **WHEN** um cliente envia um email que não pertence a nenhum usuário
- **THEN** o sistema responde `401` com `INVALID_CREDENTIALS`, idêntico ao caso de senha incorreta

### Requirement: Token de acesso com identidade e flag de administrador
O `token` retornado no login SHALL ser um JWT assinado com o segredo configurado no ambiente, com validade de 7 dias, contendo o identificador do usuário, nome, email e a flag `admin`. Um token expirado ou com assinatura inválida MUST ser rejeitado pelos endpoints protegidos.

#### Scenario: Token carrega admin
- **WHEN** um administrador faz login
- **THEN** o payload do token contém `admin: true` e o identificador do usuário

#### Scenario: Token inválido
- **WHEN** um cliente chama um endpoint protegido com um token expirado ou adulterado
- **THEN** o sistema responde `401`

### Requirement: Usuário autenticado da requisição
O sistema SHALL expor `GET /auth/me`, protegido por token Bearer, que responde `200` com `id`, `name`, `email` e `admin` do usuário do token. Sem token MUST responder `401`. Todo endpoint protegido MUST ter acesso à flag `admin` do usuário autenticado.

#### Scenario: Consulta do próprio usuário
- **WHEN** um cliente chama `GET /auth/me` com o token de um administrador
- **THEN** o sistema responde `200` com os dados do usuário e `admin: true`

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /auth/me` sem cabeçalho de autorização
- **THEN** o sistema responde `401`
