# Carrinho na Loja (Storefront Cart) Specification

## Purpose

Define como o carrinho funciona na loja pública do Jaja: o carrinho do visitante guardado no navegador, o carrinho da conta e a mescla ao entrar, o contador do cabeçalho, a gaveta do carrinho, o botão "+" nos cards e o "Adicionar" no detalhe do produto.
## Requirements
### Requirement: Carrinho do visitante no navegador
Sem sessão, a loja SHALL guardar no navegador os produtos e as quantidades do carrinho, na ordem de inclusão. O carrinho do visitante MUST continuar igual depois de recarregar a página e MUST refletir, em outra aba do mesmo navegador, as mudanças feitas numa aba. Os dados exibidos das linhas (nome, foto, unidade, preço atual e disponibilidade) e os totais MUST vir da prévia do carrinho da API (`orders/cart`), e um produto que não existe mais MUST ser retirado do carrinho do visitante. As regras de quantidade valem também para o visitante: passar de 99 unidades num produto MUST exibir "Limite de 99 unidades por produto." e passar de 50 produtos diferentes MUST exibir "O carrinho aceita até 50 produtos diferentes.", sem alterar o carrinho. Um carrinho salvo por versões anteriores da loja, com os produtos fictícios, MUST ser descartado.

#### Scenario: Recarregar a vitrine
- **WHEN** um visitante sem sessão adiciona dois produtos pelos cards e recarrega a página
- **THEN** o contador do cabeçalho continua com 2 e a gaveta mostra os dois produtos com foto e preço atual

#### Scenario: Duas abas
- **WHEN** o visitante tem a loja aberta em duas abas e adiciona um produto na primeira
- **THEN** o contador do cabeçalho da segunda aba passa a incluir o produto

#### Scenario: Limite por produto
- **WHEN** o visitante tenta passar de 99 unidades de um produto
- **THEN** a quantidade continua em 99 e, se a tentativa vier do botão "Adicionar", aparece "Limite de 99 unidades por produto."

### Requirement: Carrinho da conta e mescla ao entrar
Com sessão, a loja SHALL exibir o carrinho da conta do usuário autenticado. Ao haver sessão e itens no carrinho do visitante (depois de entrar em `/entrar`, criar conta, entrar pelo `/checkout` ou abrir a loja já autenticado), a loja MUST mesclar esses itens no carrinho da conta, com as regras de `orders/cart`, e MUST apagar o carrinho do visitante do navegador só depois de a mescla dar certo. Se a mescla falhar, a loja MUST exibir a mensagem de erro, mostrar o carrinho da conta e manter os itens do visitante no navegador para uma nova tentativa. Ao sair, a loja MUST voltar a exibir o carrinho do visitante, e o carrinho da conta MUST continuar salvo para o próximo acesso. O carrinho da conta MUST ser recarregado ao abrir a gaveta e ao abrir o checkout.

#### Scenario: Entrar com itens de visitante
- **WHEN** um visitante com o produto A (quantidade 3) e o produto B (quantidade 1) no carrinho entra numa conta que já tinha A com quantidade 2
- **THEN** a gaveta passa a mostrar A com quantidade 5 e B com quantidade 1, e o carrinho do visitante é apagado do navegador

#### Scenario: Sair
- **WHEN** o cliente autenticado com itens no carrinho usa "sair" no cabeçalho
- **THEN** o contador do cabeçalho mostra 0 e a gaveta mostra o carrinho vazio

#### Scenario: Entrar de novo
- **WHEN** esse cliente entra novamente
- **THEN** a gaveta volta a mostrar os itens do carrinho da conta

#### Scenario: Criar conta no checkout
- **WHEN** um visitante com itens no carrinho clica em "Finalizar pedido" e cria conta em `/checkout`
- **THEN** o resumo do pedido passa a mostrar esses itens, agora no carrinho da nova conta

### Requirement: Contador do carrinho no cabeçalho
O botão do carrinho no cabeçalho da loja SHALL exibir a soma das quantidades de todos os itens do carrinho exibido (visitante ou conta), inclusive os indisponíveis. Ao incluir, alterar ou remover um item, o contador MUST mudar imediatamente, sem esperar a resposta da API. Até a página hidratar, o contador MUST exibir 0.

#### Scenario: Contador atualizado
- **WHEN** o carrinho tem um produto com quantidade 2 e o visitante clica em "+" no card de outro produto
- **THEN** o contador passa de 2 para 3

### Requirement: Gaveta do carrinho
O botão do carrinho SHALL abrir a gaveta com o carrinho exibido. Cada linha MUST mostrar a foto do produto (ou a ilustração da categoria), o nome como link para o detalhe do produto, preservando os parâmetros da vitrine e fechando a gaveta, a unidade, o preço unitário, o controle de quantidade, o total da linha e a ação de remover. Diminuir a quantidade até 0 MUST remover o item, e o controle MUST impedir passar de 99. Uma linha indisponível MUST mostrar "Indisponível" e a ação "Remover", sem controle de quantidade e sem total. O rodapé MUST mostrar o subtotal, a entrega ("Grátis" ou o valor), "Faltam <valor> para a entrega grátis." quando a entrega é cobrada, o total e o botão "Finalizar pedido · <total>". Com itens indisponíveis, a gaveta MUST exibir "Remova os itens indisponíveis para continuar." e o botão MUST ficar indisponível. Enquanto uma mudança não foi confirmada pela API, os valores MUST ser sinalizados como em atualização e o botão MUST ficar indisponível. Na primeira carga, a gaveta MUST exibir uma estrutura de carregamento no lugar das linhas.

#### Scenario: Alterar quantidade na gaveta
- **WHEN** na gaveta, com um produto de R$ 12,90 em quantidade 1, o visitante clica em "+"
- **THEN** a quantidade passa a 2 imediatamente e, com a resposta da API, o total da linha mostra `R$ 25,80`, a entrega `R$ 4,90` e "Faltam R$ 53,20 para a entrega grátis."

#### Scenario: Remover pela quantidade
- **WHEN** o visitante diminui até 0 a quantidade do único produto do carrinho
- **THEN** a linha some e a gaveta mostra "Seu carrinho está vazio."

#### Scenario: Item indisponível
- **WHEN** o cliente abre a gaveta com um produto que foi desativado no admin
- **THEN** a linha mostra "Indisponível" e "Remover", aparece "Remova os itens indisponíveis para continuar." e "Finalizar pedido" fica indisponível até o item ser removido

#### Scenario: Entrega grátis
- **WHEN** o subtotal dos itens disponíveis chega a R$ 79,00
- **THEN** a entrega aparece como "Grátis" e o aviso de quanto falta deixa de aparecer

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

