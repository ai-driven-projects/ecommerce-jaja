## MODIFIED Requirements

### Requirement: Ação principal da página
A página SHALL ter uma única ação principal, fixa no rodapé e visível enquanto o produto está carregado: o controle de quantidade (de 1 a 99, começando em 1) e o botão "Adicionar · <total>", com o total do preço pela quantidade escolhida. Tocar no botão MUST incluir a quantidade escolhida no carrinho, somando à que já estiver nele; enquanto a inclusão não termina, o botão MUST mostrar "Adicionando…" e ficar indisponível. No sucesso, MUST aparecer o aviso "Adicionado ao carrinho" com "<quantidade> un · <total>" e a ação "Ver carrinho", que abre a aba Carrinho, e a quantidade escolhida MUST voltar a 1. Na falha (limite do carrinho), MUST aparecer a mensagem da regra e o carrinho MUST NOT mudar. Com o produto no carrinho, o rodapé MUST mostrar "Você já tem <quantidade> no carrinho.".

#### Scenario: Ação visível sem carrinho
- **WHEN** o produto de R$ 12,90 está carregado e não está no carrinho
- **THEN** o rodapé mostra a quantidade 1 e "Adicionar · R$ 12,90" habilitado, sem "Você já tem"

#### Scenario: Adicionar três unidades
- **WHEN** a pessoa escolhe quantidade 3 num produto de R$ 12,90 e toca em "Adicionar · R$ 38,70"
- **THEN** aparece "Adicionado ao carrinho" com "3 un · R$ 38,70", o badge do Carrinho aumenta em 3, a quantidade volta a 1 e aparece "Você já tem 3 no carrinho."

#### Scenario: Limite excedido
- **WHEN** o produto já está no carrinho com 98 e a pessoa tenta adicionar 3
- **THEN** aparece "Limite de 99 unidades por produto." e o produto continua com 98

## ADDED Requirements

### Requirement: Cartão de entrega no produto
Abaixo do preço, a página SHALL mostrar o cartão "Entrega grátis acima de R$ 79,00" com "Abaixo disso, taxa fixa de R$ 4,90", com os valores das regras do carrinho.

#### Scenario: Cartão de entrega
- **WHEN** o produto está carregado
- **THEN** a página mostra "Entrega grátis acima de R$ 79,00" e "Abaixo disso, taxa fixa de R$ 4,90"
