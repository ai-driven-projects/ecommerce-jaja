# Loja do App Mobile (Mobile Store) Specification

## Purpose

Define como o app mobile do cliente Jajá conhece as lojas ativas da vitrine, decide qual loja está em vigor e lembra a escolha no aparelho, e como o seletor de loja da aba Início se apresenta e se comporta em cada estado.
## Requirements
### Requirement: Lojas ativas da vitrine
O app SHALL obter as lojas de `GET /storefront/stores`, sem token, e usá-las na ordem devolvida pela API. Cada loja MUST ter `id`, `name`, `slug`, `address` (texto ou ausente), `latitude`, `longitude` e `deliveryRadiusMeters`; campos a mais na resposta MUST ser ignorados. Uma resposta fora desse formato MUST virar falha inesperada, sem exceção. Depois de uma leitura bem-sucedida, o app SHALL reaproveitar a lista enquanto estiver aberto, salvo quando a pessoa pede para atualizar; uma falha MUST NOT ser guardada, e a próxima tentativa busca de novo.

#### Scenario: Lojas do seed
- **WHEN** a API responde `200` com "Loja Paulista" (`slug: "loja-paulista"`) e "Loja Rio Branco" (`slug: "loja-rio-branco"`), nessa ordem
- **THEN** o app tem as duas lojas nessa ordem, com nome, slug, endereço, ponto e raio

#### Scenario: Resposta fora do formato
- **WHEN** a API responde `200` com um item sem `slug`
- **THEN** o resultado é a falha inesperada "Algo deu errado. Tente novamente."

#### Scenario: Lista reaproveitada
- **WHEN** a lista já foi lida com sucesso e outra tela pede as lojas sem pedir atualização
- **THEN** nenhuma nova requisição é feita

### Requirement: Loja em vigor
A loja em vigor SHALL ser, nesta ordem: a loja lembrada no aparelho, se o slug dela estiver entre as lojas ativas; senão, a primeira loja ativa; sem nenhuma loja ativa, nenhuma. Uma lembrança com slug desconhecido MUST ser ignorada sem erro e MUST NOT ser apagada nem trocada pela loja padrão. A memória da escolha MUST guardar só o slug, MUST NOT ser enviada à API e, quando indisponível ou ilegível, MUST ser tratada como ausente.

#### Scenario: Primeira abertura
- **WHEN** o app abre sem escolha lembrada e a API devolve "Loja Paulista" e "Loja Rio Branco"
- **THEN** a loja em vigor é "Loja Paulista"

#### Scenario: Escolha lembrada
- **WHEN** a pessoa escolheu "Loja Rio Branco", fecha o app e o abre de novo
- **THEN** a loja em vigor é "Loja Rio Branco"

#### Scenario: Loja lembrada que saiu da vitrine
- **WHEN** a loja lembrada é `loja-rio-branco` e a API devolve só "Loja Paulista"
- **THEN** a loja em vigor é "Loja Paulista", sem erro, e a lembrança continua `loja-rio-branco`

### Requirement: Seletor de loja
O topo da aba Início SHALL mostrar a loja em vigor numa pílula com o ícone de loja, o nome e, quando o endereço de referência termina em `<Cidade>/<UF>`, " · <Cidade>/<UF>" (UF em maiúsculas); sem esse final, só o nome. Com duas ou mais lojas ativas, tocar na pílula MUST abrir um painel inferior "Comprar na loja" com as lojas ativas na ordem da API, cada uma com o nome e a cidade/UF quando conhecida, e a atual marcada. Escolher uma loja MUST fechar o painel, mostrar a nova loja na pílula e lembrar a escolha; escolher a atual só fecha o painel. Com uma loja só, a pílula MUST ser estática, sem painel. Escolher a loja MUST NOT mudar o catálogo, os preços nem acrescentar parâmetro a qualquer chamada da API.

#### Scenario: Pílula com cidade e UF
- **WHEN** a loja em vigor é "Loja Paulista", com endereço "Avenida Paulista, 2073 – Conjunto Nacional, Bela Vista, São Paulo/SP"
- **THEN** a pílula mostra "Loja Paulista" e "São Paulo/SP"

#### Scenario: Troca de loja
- **WHEN** a pessoa toca na pílula, vê "Comprar na loja" com "Loja Paulista" marcada e escolhe "Loja Rio Branco"
- **THEN** o painel fecha, a pílula mostra "Loja Rio Branco" e o slug `loja-rio-branco` fica lembrado no aparelho

#### Scenario: Loja única
- **WHEN** a API devolve só "Loja Paulista" e a pessoa toca na pílula
- **THEN** nenhum painel abre

### Requirement: Estados do seletor
O bloco do seletor SHALL seguir o padrão de tela remota: skeleton no formato da pílula enquanto as lojas carregam (inclusive ao tentar de novo); em falha, o banner de erro com o título "Não foi possível carregar as lojas.", a mensagem da falha e "Tentar de novo", substituindo só o bloco do seletor; sem nenhuma loja ativa, o estado vazio "Nenhuma loja disponível" com a mensagem "No momento nenhuma loja está atendendo." e a ação única "Atualizar", que busca a lista de novo sem reaproveitar a anterior.

#### Scenario: Carregando
- **WHEN** a aba Início abre e a API ainda não respondeu
- **THEN** o bloco do seletor mostra um skeleton e nenhuma loja

#### Scenario: Falha e nova tentativa
- **WHEN** a leitura das lojas falha por rede e a pessoa toca em "Tentar de novo" com a API já respondendo
- **THEN** o banner mostra "Não foi possível carregar as lojas." e "Não foi possível falar com o servidor. Tente novamente.", e depois da nova tentativa a pílula mostra a loja em vigor

#### Scenario: Nenhuma loja ativa
- **WHEN** a API responde `200` com lista vazia e a pessoa toca em "Atualizar"
- **THEN** o bloco mostra "Nenhuma loja disponível" e o toque faz uma nova requisição a `GET /storefront/stores`
