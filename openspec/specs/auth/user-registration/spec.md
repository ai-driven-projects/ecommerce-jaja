# Registro de Usuário (User Registration) Specification

## Purpose

Define como um usuário é registrado no Jaja: dados aceitos, validações, unicidade de email, guarda da senha, atomicidade da persistência, a regra de que o registro nunca cria administradores e o seed de usuários de desenvolvimento.

## Requirements

### Requirement: Registro de usuário por email e senha
O sistema SHALL expor um endpoint público `POST /auth/register` que recebe `name`, `email`, `password` e, opcionalmente, `avatarUrl`. Em sucesso MUST responder `201` sem corpo. `name` MUST ser um nome de pessoa com nome e sobrenome, `email` MUST ser um email válido e `avatarUrl`, quando informado, MUST ser uma URL http(s). Dados inválidos MUST responder `400` com os códigos de erro de validação no corpo, sem criar nada.

#### Scenario: Registro válido
- **WHEN** um cliente envia `{ name: "Ana Souza", email: "ana@exemplo.com", password: "#Senha123" }`
- **THEN** o sistema responde `201` sem corpo e o usuário passa a existir com esse nome e email

#### Scenario: Nome ou email inválidos
- **WHEN** um cliente envia `name: "Ana"` (sem sobrenome) ou `email: "ana@"`
- **THEN** o sistema responde `400` com os códigos de erro correspondentes e nenhum usuário é criado

### Requirement: Email único
O email SHALL identificar unicamente um usuário. Uma tentativa de registro com um email já cadastrado MUST responder `409` com o código `EMAIL_ALREADY_EXISTS` e MUST NOT alterar o usuário existente.

#### Scenario: Email já cadastrado
- **WHEN** um cliente envia um registro com um email que já pertence a um usuário
- **THEN** o sistema responde `409` com `EMAIL_ALREADY_EXISTS` e o usuário existente permanece inalterado

### Requirement: Senha forte guardada apenas como hash
A senha informada no registro MUST atender à política de senha forte do projeto (tamanho mínimo, letras maiúsculas e minúsculas, dígito e caractere especial); caso contrário o sistema MUST responder `400` com o código de senha fraca. A senha MUST ser armazenada exclusivamente como hash bcrypt, em registro separado do usuário, e MUST NOT ser retornada por nenhum endpoint.

#### Scenario: Senha fraca
- **WHEN** um cliente envia `password: "123456"`
- **THEN** o sistema responde `400` com o código de senha fraca e nenhum usuário é criado

#### Scenario: Senha nunca exposta
- **WHEN** um usuário é registrado com sucesso
- **THEN** o valor guardado para a senha é um hash bcrypt e nenhuma resposta da API contém a senha nem o hash

### Requirement: Persistência atômica de usuário e senha
A criação do usuário e da sua senha SHALL ocorrer em uma única transação. Se a gravação da senha falhar, o usuário MUST NOT permanecer gravado.

#### Scenario: Falha ao gravar a senha
- **WHEN** a gravação da senha falha após a gravação do usuário
- **THEN** a transação é revertida e não existe usuário com aquele email

### Requirement: Registro nunca cria administrador
Todo usuário criado pelo registro MUST nascer com a flag `admin` igual a `false`. Um campo `admin` enviado no corpo do registro MUST ser ignorado. Administradores só existem por carga de dados (seed) nesta entrega.

#### Scenario: Tentativa de se registrar como admin
- **WHEN** um cliente envia um registro válido contendo `admin: true`
- **THEN** o usuário é criado com `admin = false`

### Requirement: Seed de usuários de desenvolvimento
O sistema SHALL fornecer um seed com 80 usuários válidos (nome com sobrenome, email único, avatar http(s) ou nulo) e a senha `#Senha123` para todos. Os usuários `usuario@formacao.dev` e `admin@jaja.dev` MUST ser administradores e os demais MUST NOT ser. O seed MUST ser idempotente: executá-lo novamente MUST NOT duplicar usuários nem falhar.

#### Scenario: Seed executado duas vezes
- **WHEN** o seed é executado em um banco vazio e depois executado de novo
- **THEN** existem exatamente 80 usuários, `usuario@formacao.dev` e `admin@jaja.dev` são administradores e todos autenticam com `#Senha123`
