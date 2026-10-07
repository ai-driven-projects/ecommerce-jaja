## Purpose

Define o que o backend oferece para rodar atrás de um balanceador e ser chamado de outro domínio: uma verificação de saúde pública e a origem do CORS configurável.

## ADDED Requirements

### Requirement: Verificação de saúde pública
O backend SHALL responder `GET /health` sem autenticação, com status 200 e corpo JSON `{ "status": "ok" }`, assim que a aplicação estiver aceitando requisições. A rota MUST NOT consultar o banco nem o broker: ela indica só que o processo está vivo, para que uma indisponibilidade momentânea do broker não tire todas as tasks do balanceador. A resposta MUST NOT expor versão, configuração nem dados de infraestrutura.

#### Scenario: Backend no ar
- **WHEN** alguém chama `GET /health` sem token
- **THEN** recebe 200 com `{ "status": "ok" }`

#### Scenario: Broker indisponível
- **WHEN** o broker está fora do ar e alguém chama `GET /health`
- **THEN** recebe 200 com `{ "status": "ok" }`

### Requirement: Origem do CORS configurável
O backend SHALL ler `CORS_ORIGIN`, uma lista de origens separadas por vírgula (por exemplo, `http://localhost:3000,https://jaja.exemplo.com.br`). Com a variável preenchida, só essas origens MUST receber os cabeçalhos de CORS. Com a variável vazia ou ausente, qualquer origem MUST ser aceita, como hoje no ambiente local. O `apps/backend/.env.example` SHALL documentar `CORS_ORIGIN` vazia, com um comentário explicando o efeito.

#### Scenario: Origem permitida
- **WHEN** `CORS_ORIGIN="https://jaja.exemplo.com.br"` e o navegador faz um preflight vindo de `https://jaja.exemplo.com.br`
- **THEN** a resposta inclui `Access-Control-Allow-Origin: https://jaja.exemplo.com.br`

#### Scenario: Origem recusada
- **WHEN** `CORS_ORIGIN="https://jaja.exemplo.com.br"` e o preflight vem de `https://outro.site`
- **THEN** a resposta não inclui `Access-Control-Allow-Origin`

#### Scenario: Ambiente local
- **WHEN** `CORS_ORIGIN` está vazia e o frontend em `http://localhost:3000` chama a API
- **THEN** a chamada é aceita
