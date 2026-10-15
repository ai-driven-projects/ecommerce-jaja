# HTTP do App Mobile (Mobile HTTP) Specification

## Purpose

Define como o app mobile do cliente Jajá conversa com o backend: o cliente configurado para o endereço da API, as chamadas que sempre terminam num resultado e a classificação de falhas de rede e respostas de erro em falhas tipadas com mensagem para a pessoa.
## Requirements
### Requirement: Chamadas à API configurada
O app SHALL enviar toda requisição ao backend para o endereço base resolvido de `API_URL`, trocando e aceitando JSON. A conexão MUST desistir depois de 5 segundos e a espera pela resposta depois de 10 segundos. A configuração do cliente MUST ser verificável sem rede.

#### Scenario: Requisição relativa ao endereço base
- **WHEN** o app pede `GET /storefront/stores` com o endereço base `http://10.0.2.2:4000`
- **THEN** a requisição sai para `http://10.0.2.2:4000/storefront/stores` com cabeçalho `Accept: application/json`

### Requirement: Chamada que devolve resultado
Uma chamada à API feita pela camada de infraestrutura SHALL terminar sempre num resultado (sucesso com o valor convertido, ou falha tipada), nunca numa exceção. Erro ao converter o corpo de uma resposta de sucesso, ou qualquer erro imprevisto, MUST virar falha inesperada com a mensagem "Algo deu errado. Tente novamente.".

#### Scenario: Resposta de sucesso
- **WHEN** a API responde `200` com um corpo que a conversão aceita
- **THEN** o resultado é sucesso com o valor convertido

#### Scenario: Corpo que não converte
- **WHEN** a API responde `200` com um corpo que a conversão rejeita
- **THEN** o resultado é uma falha inesperada com "Algo deu errado. Tente novamente." e nenhuma exceção escapa

### Requirement: Falha de rede
Sem conexão com o servidor, conexão recusada ou tempo esgotado (conexão, envio ou resposta) SHALL resultar em falha de rede com a mensagem "Não foi possível falar com o servidor. Tente novamente.".

#### Scenario: Servidor fora do ar
- **WHEN** a conexão com o backend é recusada
- **THEN** o resultado é uma falha de rede com "Não foi possível falar com o servidor. Tente novamente."

#### Scenario: Tempo esgotado
- **WHEN** o backend não responde dentro do tempo limite
- **THEN** o resultado é uma falha de rede

### Requirement: Classificação das respostas de erro
Uma resposta de erro do backend SHALL ser classificada pelo status HTTP: `401` vira falha de sessão ("Sua sessão expirou. Entre de novo."); `404` vira não encontrado ("Não encontramos o que você procurou."); qualquer outro `4xx` vira recusa do backend com o status e a mensagem "Não foi possível concluir. Tente novamente."; `5xx` vira erro do servidor ("O servidor está indisponível no momento. Tente novamente em instantes."). A recusa MUST carregar os códigos do campo `message` do corpo (`ApiErrorResponse`), na ordem recebida, aceitando lista ou texto único; corpo ausente ou fora do formato MUST resultar em lista vazia, sem mudar a classificação. A mensagem MUST NOT conter códigos do backend, textos de exceção nem detalhes técnicos.

#### Scenario: Recusa com códigos
- **WHEN** o backend responde `400` com `{"statusCode":400,"error":"Bad Request","message":["CART_ITEMS_LIMIT_EXCEEDED","CART_ITEM_QUANTITY_EXCEEDED"]}`
- **THEN** o resultado é uma recusa do backend com status `400`, os códigos `CART_ITEMS_LIMIT_EXCEEDED` e `CART_ITEM_QUANTITY_EXCEEDED` nessa ordem e a mensagem "Não foi possível concluir. Tente novamente."

#### Scenario: Sessão expirada e recurso inexistente
- **WHEN** o backend responde `401`, e depois `404`
- **THEN** o primeiro resultado é falha de sessão e o segundo é não encontrado, cada um com sua mensagem

#### Scenario: Erro do servidor com corpo fora do formato
- **WHEN** o backend responde `503` com um corpo HTML
- **THEN** o resultado é erro do servidor com "O servidor está indisponível no momento. Tente novamente em instantes."
