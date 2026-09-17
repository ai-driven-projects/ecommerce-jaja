## Purpose

Define a leitura pública das lojas pela vitrine: `GET /storefront/stores`, que expõe só as lojas ativas com nome, slug, endereço de referência, ponto e raio de atendimento, sem dados administrativos, para a loja posicionar mapas e, no futuro, decidir a cobertura.

## ADDED Requirements

### Requirement: Listar lojas da vitrine
O sistema SHALL expor `GET /storefront/stores`, acessível sem token. Um cabeçalho `Authorization` enviado (válido ou não) MUST ser ignorado. A resposta MUST ser `200` com uma lista em que cada item traz apenas `id`, `name`, `slug`, `address` (texto de referência da loja ou `null`), `latitude`, `longitude` (6 casas decimais) e `deliveryRadiusMeters`. A lista MUST conter só lojas ativas e não excluídas, ordenadas pelo nome sem distinção de maiúsculas e acentos. Quando não houver loja ativa, MUST responder `200` com lista vazia. O endpoint MUST NOT criar nem alterar lojas.

#### Scenario: Lojas do seed sem token
- **WHEN** após o seed um visitante sem token chama `GET /storefront/stores`
- **THEN** o sistema responde `200` com as lojas "Loja Paulista" (`slug: "loja-paulista"`) e "Loja Rio Branco" (`slug: "loja-rio-branco"`), nessa ordem, cada uma com `latitude`, `longitude` e `deliveryRadiusMeters`

#### Scenario: Token inválido é ignorado
- **WHEN** um visitante chama `GET /storefront/stores` com um token adulterado no cabeçalho `Authorization`
- **THEN** o sistema responde `200` com a mesma lista, sem `401`

#### Scenario: Loja inativa fora da vitrine
- **WHEN** um administrador desativa a "Loja Rio Branco" e um visitante chama `GET /storefront/stores`
- **THEN** a lista contém só a "Loja Paulista"

### Requirement: Sem dados administrativos na vitrine
Os itens de `GET /storefront/stores` MUST NOT conter `phone`, `isActive`, `createdAt`, `updatedAt`, `deletedAt` nem qualquer outro campo além dos listados em "Listar lojas da vitrine".

#### Scenario: Campos da resposta
- **WHEN** um visitante sem token chama `GET /storefront/stores`
- **THEN** nenhum item da resposta tem as propriedades `phone`, `isActive`, `createdAt` ou `updatedAt`
