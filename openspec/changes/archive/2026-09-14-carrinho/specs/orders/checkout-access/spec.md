## ADDED Requirements

### Requirement: Resumo do pedido com o carrinho da conta
Com sessão, o "Resumo do pedido" de `/checkout` SHALL exibir o carrinho da conta do usuário autenticado, recarregado ao abrir a página:
- cada linha MUST mostrar a foto do produto (ou a ilustração da categoria), o nome, "× <quantidade>" e o total da linha;
- uma linha indisponível MUST mostrar "Indisponível" e a ação "Remover";
- o subtotal, a entrega e o total MUST ser os calculados pela API.

Enquanto o carrinho é carregado, inclusive durante a mescla do carrinho do visitante logo depois de entrar ou criar conta na própria página, o resumo MUST exibir uma estrutura de carregamento.

"Confirmar pedido" MUST ficar desabilitado enquanto o carrinho carrega ou tem uma mudança não confirmada, quando o carrinho está vazio e quando tem itens indisponíveis, sem afastar as demais condições para confirmar. Com itens indisponíveis, o texto "Remova os itens indisponíveis para confirmar o pedido." MUST aparecer abaixo do botão.

A confirmação continua simulada, mas MUST esvaziar o carrinho da conta antes de levar ao acompanhamento do pedido. Se esvaziar o carrinho falhar, a página MUST exibir a mensagem de erro e continuar em `/checkout`.

#### Scenario: Carrinho do visitante após criar conta
- **WHEN** um visitante com dois produtos no carrinho cria conta em `/checkout`
- **THEN** o resumo exibe a estrutura de carregamento e, em seguida, os dois produtos com foto, quantidade, total da linha e os totais da API

#### Scenario: Item indisponível bloqueia a confirmação
- **WHEN** o carrinho da conta tem um produto que foi desativado no admin e o cliente abre `/checkout`
- **THEN** a linha mostra "Indisponível", "Confirmar pedido" fica desabilitado e o texto "Remova os itens indisponíveis para confirmar o pedido." aparece

#### Scenario: Remover o item indisponível
- **WHEN** nesse resumo o cliente clica em "Remover" na linha indisponível
- **THEN** a linha some, os totais são atualizados e o texto sobre itens indisponíveis deixa de aparecer

#### Scenario: Confirmar esvazia o carrinho
- **WHEN** o cliente confirma o pedido com todas as condições atendidas
- **THEN** o carrinho da conta fica vazio, o cliente é levado ao acompanhamento do pedido e, ao voltar para a loja, o contador do carrinho mostra 0
