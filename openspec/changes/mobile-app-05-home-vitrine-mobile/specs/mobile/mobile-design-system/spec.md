## MODIFIED Requirements

### Requirement: Card de produto
O app SHALL ter um card de produto base: branco, com borda de linha e raio 18, contendo a área de imagem, o nome em até 3 linhas, a unidade em cinza e o preço (com o preço anterior quando houver). A área de imagem MUST mostrar a foto inteira sobre branco quando há endereço de foto, carregando-a pelo cache de imagens do aparelho (uma foto já baixada MUST ser reaproveitada sem nova requisição) e mostrando a área branca vazia enquanto ela chega; quando não há foto ou ela não carrega, MUST mostrar o emoji de reserva sobre o tom pastel informado (padrão 🛒 sobre o verde-claro). A área de imagem MUST ter um único selo, nesta prioridade: `−N%` quando há desconto, senão "Destaque" quando o produto está em destaque. O card MUST mostrar uma ação ao lado do preço só quando ela for fornecida, e o toque no card MUST chamar a ação de abrir o produto. O nome completo MUST ficar disponível a leitores de tela.

#### Scenario: Selo de desconto vence o destaque
- **WHEN** um card exibe um produto em destaque com desconto de 19%, preço de 1290 e preço anterior de 1590 centavos
- **THEN** o selo mostra `−19%` e não "Destaque", e o preço mostra `R$ 12,90` com `R$ 15,90` riscado

#### Scenario: Produto sem foto
- **WHEN** um card exibe um produto sem foto e sem emoji de reserva
- **THEN** a área de imagem mostra 🛒 sobre o tom verde-claro

#### Scenario: Foto que não carrega
- **WHEN** um card exibe um produto com endereço de foto que não pode ser baixada
- **THEN** a área de imagem mostra o emoji de reserva sobre o tom pastel, sem erro na tela

#### Scenario: Sem ação de carrinho
- **WHEN** o card é exibido sem ação ao lado do preço
- **THEN** nenhum controle aparece ao lado do preço
