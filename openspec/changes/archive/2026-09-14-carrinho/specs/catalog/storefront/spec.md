## MODIFIED Requirements

### Requirement: Fechar pedido leva ao checkout
O botão "Finalizar pedido" do carrinho SHALL fechar o painel do carrinho e navegar para `/checkout` preservando todos os parâmetros atuais da vitrine (bairro, categoria, busca, filtros, ordenação e página). A navegação MUST NOT depender de sessão: quem não estiver autenticado é identificado na própria página de checkout, e os itens do carrinho do visitante seguem para a conta ao entrar (`orders/storefront-cart`). O botão MUST ficar indisponível quando o carrinho está vazio, quando tem itens indisponíveis ou enquanto uma mudança no carrinho não foi confirmada.

#### Scenario: Fechar pedido com bairro e categoria
- **WHEN** um visitante com itens no carrinho em `/?bairro=Meireles&categoria=escrita-corretivos` clica em "Finalizar pedido"
- **THEN** o painel do carrinho fecha e a página passa a `/checkout?bairro=Meireles&categoria=escrita-corretivos`

#### Scenario: Fechar pedido sem sessão
- **WHEN** um visitante sem sessão, com itens no carrinho, clica em "Finalizar pedido"
- **THEN** chega a `/checkout` e vê o formulário de entrar/criar conta, sem ser redirecionado para `/entrar`

#### Scenario: Carrinho vazio
- **WHEN** o visitante abre o carrinho sem itens
- **THEN** o botão "Finalizar pedido" está indisponível

## REMOVED Requirements

### Requirement: Sacola vazia nesta entrega
**Reason**: o carrinho passa a aceitar produtos reais, pelos cards e pelo detalhe, e a ser guardado no navegador (visitante) ou na conta (usuário autenticado).
**Migration**: o comportamento do carrinho na loja passa a ser definido por `orders/storefront-cart` ("Carrinho do visitante no navegador", "Carrinho da conta e mescla ao entrar", "Contador do carrinho no cabeçalho" e "Gaveta do carrinho"), e as regras do carrinho por `orders/cart`.

### Requirement: Botão Adicionar sem efeito no carrinho
**Reason**: "Adicionar" no detalhe e o "+" nos cards passam a incluir produtos no carrinho.
**Migration**: ver "Adicionar no detalhe do produto" e "Adicionar pelos cards da loja" em `orders/storefront-cart`.
