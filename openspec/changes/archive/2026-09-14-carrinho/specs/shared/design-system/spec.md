## MODIFIED Requirements

### Requirement: Grade e card de produto
A grade de produtos SHALL ter 2 colunas fluidas em telas estreitas e, a partir de 640px, colunas automáticas com largura mínima de 180px (220px na seção de ofertas), com espaçamento de 14px.

Cada card SHALL ser branco, com borda fina, e exibir:
- **Área de imagem** (ver "Imagem do produto"), com um único selo no canto, nesta prioridade:
  1. o desconto `−N%`, quando o produto tem preço "De:";
  2. "Destaque", quando o produto está em destaque;
  3. o tempo de entrega, quando conhecido.
- **Nome:** peso 700, limitado a 3 linhas, com o nome completo disponível como título.
- **Unidade:** em cinza.
- **Preço:** com o preço "De:" riscado, quando houver.
- **Botão de adicionar ao carrinho:** só quando a página fornecer essa ação. Com o produto fora do carrinho, é o "+" redondo laranja em contorno; com o produto no carrinho, vira o controle de quantidade (−, número, +) com a quantidade atual. Quando a página informar uma quantidade máxima, o "+" do controle MUST ficar indisponível ao atingi-la.

A área de imagem e o nome MUST levar ao detalhe do produto. Em hover, o card MUST subir levemente e ganhar sombra.

#### Scenario: Grade no desktop
- **WHEN** a grade é exibida em uma janela de 1280px de largura
- **THEN** os cards ocupam colunas automáticas de no mínimo 180px, separadas por 14px, preenchendo a largura disponível

#### Scenario: Grade no mobile
- **WHEN** a grade é exibida em uma janela de 375px de largura
- **THEN** há 2 colunas de cards

#### Scenario: Hover no card
- **WHEN** o ponteiro está sobre um card
- **THEN** o card sobe levemente e ganha sombra

#### Scenario: Selo de desconto
- **WHEN** um card exibe um produto em destaque com `priceCents: 1290` e `listPriceCents: 1590`
- **THEN** o selo mostra `−19%`, e não "Destaque" nem o tempo de entrega, e o preço mostra `R$ 12,90` com `R$ 15,90` riscado

#### Scenario: Nome longo
- **WHEN** um card exibe um produto com nome de 214 caracteres
- **THEN** o nome aparece em no máximo 3 linhas, e o nome completo fica disponível como título do link

#### Scenario: Sem ação de carrinho
- **WHEN** a página não fornece a ação de adicionar ao carrinho
- **THEN** o card não exibe o botão "+"

#### Scenario: Produto no carrinho
- **WHEN** a página fornece a ação de carrinho e informa quantidade 2 para o produto do card
- **THEN** o card exibe o controle de quantidade com 2 no lugar do "+"

#### Scenario: Quantidade máxima
- **WHEN** a página informa quantidade máxima 99 e o produto do card está com quantidade 99
- **THEN** o "+" do controle de quantidade fica indisponível

### Requirement: Painel da sacola
O painel reutilizável do carrinho SHALL abrir fixo à direita, com largura de 400px ou a largura da tela se menor, cabeçalho com o título "Seu carrinho" e um botão de fechar com o rótulo acessível "Fechar carrinho". Ao abrir, o foco MUST ir para o painel; ao fechar, o foco MUST voltar ao elemento que o abriu. O painel MUST fechar com a tecla Escape e com clique no fundo escurecido. Quando o tempo de entrega é conhecido, o painel MUST exibir a faixa verde "Saindo de bike · chega em ~X min".

**Linhas:**
- cada linha MUST exibir a foto do produto (ou a ilustração da categoria), o nome em até 2 linhas como link, a unidade e o preço unitário em cinza, o controle de quantidade pequeno (0 remove; o "+" fica indisponível na quantidade máxima), o total da linha e um botão de remover com o rótulo acessível "Remover <nome> do carrinho";
- uma linha indisponível MUST exibir o conteúdo atenuado, o selo "Indisponível" e o botão "Remover", sem controle de quantidade e sem total;
- sem itens, o painel MUST exibir o emoji 🛒 com "Seu carrinho está vazio." e "Adicione itens para o escritório!";
- na primeira carga, o painel MUST exibir blocos estáticos no lugar das linhas, sem animação.

**Rodapé:**
- MUST exibir o subtotal, "Entrega de bike" com "Grátis" em verde ou o valor da entrega, "Faltam <valor> para a entrega grátis." quando a entrega é cobrada, o total e o botão primário "Finalizar pedido · <total>";
- com itens indisponíveis, MUST exibir "Remova os itens indisponíveis para continuar.";
- enquanto os valores são atualizados, eles MUST aparecer atenuados e marcados como ocupados;
- o botão MUST ficar indisponível sem itens, com itens indisponíveis ou enquanto os valores são atualizados.

#### Scenario: Sacola vazia
- **WHEN** o painel abre sem itens
- **THEN** exibe "Seu carrinho está vazio." e "Adicione itens para o escritório!", e o botão "Finalizar pedido" está indisponível

#### Scenario: Fechar com Escape
- **WHEN** o painel está aberto e o visitante pressiona Escape
- **THEN** o painel fecha e o foco volta ao botão do carrinho

#### Scenario: Fechar clicando no fundo
- **WHEN** o painel está aberto e o visitante clica no fundo escurecido
- **THEN** o painel fecha

#### Scenario: Sacola com itens
- **WHEN** o painel abre com um item de 1290 centavos e quantidade 2, subtotal de 2580, entrega de 490 e total de 3070
- **THEN** exibe o item com total `R$ 25,80`, o subtotal `R$ 25,80`, a entrega `R$ 4,90`, "Faltam R$ 53,20 para a entrega grátis." e o botão "Finalizar pedido · R$ 30,70"

#### Scenario: Item indisponível
- **WHEN** o painel abre com uma linha indisponível
- **THEN** a linha exibe "Indisponível" e "Remover", sem controle de quantidade, o rodapé exibe "Remova os itens indisponíveis para continuar." e o botão "Finalizar pedido" está indisponível

#### Scenario: Valores em atualização
- **WHEN** a página informa que o carrinho está sendo atualizado
- **THEN** o subtotal, a entrega e o total aparecem atenuados e o botão "Finalizar pedido" está indisponível
