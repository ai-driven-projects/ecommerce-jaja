## ADDED Requirements

### Requirement: Token da sessão nas requisições
Com sessão ativa, toda requisição ao backend SHALL levar o cabeçalho `Authorization: Bearer <token>`; sem sessão, MUST sair sem esse cabeçalho. Uma requisição que já define o próprio `Authorization` MUST mantê-lo. O token MUST NOT aparecer na URL nem em parâmetros de query.

#### Scenario: Requisição com sessão
- **WHEN** o app pede `GET /storefront/stores` com a sessão ativa de token `abc`
- **THEN** a requisição sai com `Authorization: Bearer abc`

#### Scenario: Requisição sem sessão
- **WHEN** o app pede `GET /storefront/stores` sem sessão
- **THEN** a requisição sai sem cabeçalho `Authorization`

### Requirement: Sessão encerrada pelo servidor
Quando uma requisição que levou o token da sessão recebe `401`, o app SHALL encerrar a sessão (apagar a sessão guardada e ficar sem sessão) e o resultado da chamada MUST continuar sendo a falha de sessão. Um `401` numa requisição sem token (como a senha errada no login) MUST NOT mexer na sessão.

#### Scenario: Token recusado
- **WHEN** com sessão ativa, uma requisição autenticada recebe `401`
- **THEN** a sessão é encerrada e a chamada termina em falha de sessão com "Sua sessão expirou. Entre de novo."

#### Scenario: Senha errada no login
- **WHEN** sem sessão, `POST /auth/login` recebe `401`
- **THEN** o app continua sem sessão, o armazenamento da sessão não é tocado e o formulário recebe a recusa
