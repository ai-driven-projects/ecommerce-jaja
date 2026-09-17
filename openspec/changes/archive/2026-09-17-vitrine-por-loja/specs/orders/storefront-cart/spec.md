## ADDED Requirements

### Requirement: Adicionar produtos pelos cards
Os cards de produto das grades da loja (seções da página inicial, listagem e "Mais de <categoria>" no detalhe) SHALL exibir o botão "+". Clicar em "+" num produto que não está no carrinho MUST incluir 1 unidade, e o botão MUST virar o controle de quantidade com a quantidade no carrinho. No controle, "+" e "−" MUST alterar a quantidade do produto no carrinho, 0 MUST remover o item e o "+" MUST ficar indisponível em 99.

O "+" MUST NOT ser bloqueado pela loja escolhida nem por qualquer verificação de área de entrega: a cobertura passa a ser decidida pelo raio da loja contra o endereço do cliente, no fluxo de pedido, e não na navegação da vitrine.

#### Scenario: Primeiro clique no card
- **WHEN** na página inicial o visitante clica em "+" num card de "Em destaque"
- **THEN** o card passa a mostrar o controle com 1, e o contador do cabeçalho aumenta em 1

#### Scenario: Produto já no carrinho
- **WHEN** a listagem exibe um produto que já está no carrinho com quantidade 4
- **THEN** o card desse produto mostra o controle de quantidade com 4

#### Scenario: Qualquer loja escolhida
- **WHEN** o visitante abre o detalhe de um produto com `loja=loja-rio-branco`
- **THEN** os cards de "Mais de <categoria>" exibem o "+"

### Requirement: Adicionar produtos no detalhe
O detalhe do produto SHALL exibir o controle de quantidade (de 1 a 99) e o botão "Adicionar · <total>", com o total calculado pela quantidade escolhida. Clicar no botão MUST incluir a quantidade escolhida no carrinho exibido, somando à quantidade que já estiver nele. Enquanto a inclusão não termina, o botão MUST mostrar "Adicionando…" e ficar indisponível. Em caso de sucesso:
- a loja MUST exibir "Adicionado ao carrinho" com "<quantidade> un · <total>" e a ação "Ver carrinho", que abre a gaveta;
- a quantidade escolhida MUST voltar a 1.

Em caso de falha (limite de 99 unidades ou produto indisponível), a loja MUST exibir a mensagem correspondente e o carrinho MUST NOT mudar. Quando o produto já está no carrinho, o detalhe MUST exibir "Você já tem <quantidade> no carrinho.". O botão MUST NOT ficar indisponível por causa da loja escolhida nem de verificação de área de entrega.

#### Scenario: Adicionar três unidades
- **WHEN** o visitante escolhe quantidade 3 num produto de R$ 12,90 e clica em "Adicionar · R$ 38,70"
- **THEN** aparece "Adicionado ao carrinho" com "3 un · R$ 38,70", o contador do cabeçalho aumenta em 3, a quantidade volta a 1 e aparece "Você já tem 3 no carrinho."

#### Scenario: Ver carrinho
- **WHEN** logo depois de adicionar, o visitante clica em "Ver carrinho" no aviso
- **THEN** a gaveta abre com o produto adicionado

#### Scenario: Limite excedido
- **WHEN** o produto já está no carrinho com quantidade 98 e o cliente tenta adicionar 3
- **THEN** aparece "Limite de 99 unidades por produto." e o produto continua com quantidade 98

#### Scenario: Adicionar com outra loja escolhida
- **WHEN** o visitante abre o detalhe de um produto com `loja=loja-rio-branco`
- **THEN** o botão "Adicionar" fica disponível

## REMOVED Requirements

### Requirement: Adicionar pelos cards da loja
**Reason**: A regra condicionava o "+" ao bairro selecionado ser atendido, e o bairro deixa de existir na vitrine (`catalog/storefront`).
**Migration**: Substituída por "Adicionar produtos pelos cards", igual no comportamento do carrinho e sem o bloqueio por cobertura.

### Requirement: Adicionar no detalhe do produto
**Reason**: A regra desabilitava "Adicionar" quando o bairro selecionado não era atendido, e o bairro deixa de existir na vitrine.
**Migration**: Substituída por "Adicionar produtos no detalhe", igual no comportamento do carrinho e sem o bloqueio por cobertura.
