# Checkout do App Mobile (Mobile Checkout) Specification

## Purpose

Define o fechamento do pedido no app mobile Jajá: a tela "Finalizar pedido", aberta pela aba Carrinho com sessão, que exige os dados de entrega, recebe quem recebe e as instruções, mostra o pagamento simulado e o resumo do carrinho da conta, e cria o pedido por `POST /me/orders`.

## Requirements

### Requirement: Acesso ao checkout
A tela "Finalizar pedido" SHALL abrir pelo "Finalizar pedido · <total>" da aba Carrinho, na pilha da própria aba, com a barra de abas visível, e MUST exigir sessão. Sem sessão, abrir o checkout MUST levar a "Entrar" com o checkout como destino, e entrar ou criar conta MUST voltar a ele, com o carrinho do visitante já mesclado ao da conta. Se a sessão expirar (`401`) com a tela aberta, o app MUST ir para "Entrar" com o checkout como destino.

#### Scenario: Visitante toca em "Finalizar pedido"
- **WHEN** um visitante com dois produtos no carrinho toca em "Finalizar pedido" e entra com credenciais válidas
- **THEN** a tela "Entrar" abre primeiro e, depois de entrar, aparece "Finalizar pedido" com o resumo em skeleton até chegar o carrinho mesclado

#### Scenario: Cliente com sessão
- **WHEN** a cliente "Ana Souza" com sessão toca em "Finalizar pedido" na aba Carrinho
- **THEN** a tela mostra os passos "Endereço de entrega" e "Pagamento", o "Resumo do pedido" e o botão "Confirmar pedido", com a aba Carrinho selecionada

### Requirement: Dados de entrega no checkout
No passo "Endereço de entrega", a tela SHALL consultar o cadastro de cliente com `GET /me/customer` ao abrir, com skeleton no lugar do passo enquanto espera. Uma falha MUST mostrar o banner "Não foi possível carregar seus dados." com "Tentar de novo". Sem cadastro (`404`), o passo MUST mostrar "Precisamos destes dados uma vez só: ficam salvos para os próximos pedidos." e a ação "Preencher dados de entrega". Com cadastro, o passo MUST mostrar o endereço em uma linha (logradouro e número, complemento quando houver, bairro, cidade/UF e CEP, separados por " · "), o telefone mascarado e a ação "Alterar". As duas ações MUST abrir a tela "Dados de entrega" na pilha do checkout, e voltar dela MUST consultar o cadastro de novo. O checkout MUST NOT mostrar aviso de cobertura nem mapa.

#### Scenario: Cliente com cadastro
- **WHEN** o cliente com cadastro na "Rua Barão de Aracati", 1200, apto 302, Meireles, Fortaleza/CE, CEP `60115080`, telefone `85999998888` abre o checkout
- **THEN** o passo mostra "Rua Barão de Aracati, 1200 · apto 302 · Meireles · Fortaleza/CE · 60115-080", "(85) 99999-8888" e "Alterar"

#### Scenario: Primeiro pedido
- **WHEN** um cliente sem cadastro toca em "Preencher dados de entrega", salva dados válidos e volta
- **THEN** o checkout consulta `GET /me/customer` de novo e passa a mostrar o resumo com o endereço salvo

### Requirement: Quem recebe e instruções
Abaixo dos dados de entrega, a tela SHALL ter "Quem recebe", pré-preenchido com o nome da conta da sessão e limitado a 100 caracteres, e "Instruções para o entregador", vazio, com o exemplo "Ex.: deixar na recepção do andar, falar com a Ana" e limitado a 200 caracteres. Os dois MUST NOT ser salvos no cadastro de cliente e MUST NOT ser validados no aparelho: a confirmação os envia como estão, e a API decide (vazio em "Quem recebe" usa o nome da conta).

#### Scenario: Valores iniciais
- **WHEN** a cliente "Ana Souza" abre o checkout
- **THEN** "Quem recebe" mostra "Ana Souza" e "Instruções para o entregador" está vazio

### Requirement: Pagamento simulado
O passo "Pagamento" SHALL mostrar o selo "Simulado" e o texto "Não pedimos nenhum dado de pagamento: nesta versão ele é simulado e aprovado automaticamente depois que você confirma o pedido.". Ele MUST NOT oferecer forma de pagamento nem campos de cartão.

#### Scenario: Sem dados de pagamento
- **WHEN** o cliente olha o passo "Pagamento"
- **THEN** vê "Simulado" e o texto do pagamento simulado, sem Pix, cartão ou faturamento

### Requirement: Resumo do pedido
O "Resumo do pedido" SHALL mostrar o carrinho da conta, relido da API ao abrir o checkout. Cada linha MUST mostrar a foto do produto (ou a ilustração da categoria), o nome, "× <quantidade>" e o total da linha. A linha indisponível MUST mostrar "Indisponível" e "Remover", que tira o produto do carrinho. Abaixo, MUST mostrar o subtotal, a "Entrega de bike" ("Grátis" quando a taxa é 0) e o total, todos da API, sinalizados como em atualização enquanto houver mudança não confirmada. Antes da primeira resposta, o resumo MUST mostrar skeleton. A falha da carga MUST mostrar o banner "Não foi possível carregar o carrinho." com "Tentar de novo". Sem itens, MUST mostrar "Seu carrinho está vazio." com a única ação "Voltar para a loja", que abre a aba Início.

#### Scenario: Linhas e totais
- **WHEN** o carrinho da conta tem 2 unidades de um produto de R$ 12,90 e a API devolve subtotal 2580, entrega 490 e total 3070
- **THEN** o resumo mostra a linha com "× 2" e `R$ 25,80`, "Subtotal" `R$ 25,80`, "Entrega de bike" `R$ 4,90` e "Total" `R$ 30,70`

#### Scenario: Remover o item indisponível
- **WHEN** o resumo tem uma linha "Indisponível" e o cliente toca em "Remover"
- **THEN** sai `DELETE /me/cart/items/<id>`, a linha some e os totais são atualizados

### Requirement: Condições para confirmar
O botão "Confirmar pedido · <total>" SHALL ficar fixo no rodapé e MUST ficar desabilitado quando: o carrinho ainda não carregou, falhou, está vazio, tem mudança não confirmada ou tem linha indisponível; o cadastro de cliente ainda não carregou, falhou ou não existe; ou um pedido está sendo enviado. Com linha indisponível, MUST aparecer abaixo do botão "Remova os itens indisponíveis para confirmar o pedido.". Sem cadastro de cliente (depois da consulta), MUST aparecer "Preencha os dados de entrega para confirmar o pedido.". Abaixo, MUST aparecer "Ao confirmar, você concorda com os termos do já já.".

#### Scenario: Sem cadastro de cliente
- **WHEN** um cliente sem cadastro e com itens disponíveis abre o checkout
- **THEN** "Confirmar pedido" está desabilitado e aparece "Preencha os dados de entrega para confirmar o pedido."

#### Scenario: Tudo pronto
- **WHEN** um cliente com cadastro e com o carrinho carregado, sem indisponíveis e sem mudança pendente, abre o checkout
- **THEN** "Confirmar pedido · <total>" está habilitado e nenhum dos dois avisos aparece

### Requirement: Confirmar o pedido
Tocar em "Confirmar pedido" SHALL enviar `POST /me/orders` com `{"recipientName": <quem recebe>, "deliveryInstructions": <instruções>}`, sem itens, preços nem dados de pagamento. Enquanto espera, o botão MUST mostrar "Confirmando…" e MUST NOT aceitar um segundo envio. No sucesso, o app MUST reler o carrinho da conta (já esvaziado pelo servidor, sem esvaziá-lo por conta própria), mostrar "Pedido #<número> recebido" com "Pagamento simulado em andamento." (o número são os 8 primeiros caracteres do id em maiúsculas) e levar à página do pedido criado, sem deixar o checkout na pilha.

#### Scenario: Pedido confirmado
- **WHEN** o cliente escreve "Deixar na recepção" nas instruções, toca em "Confirmar pedido" e a API responde `201` com o id `3f1c9a52-7b1e-4c55-9d0a-2b8e1f4c6d7a`
- **THEN** sai `POST /me/orders` com `"recipientName":"Ana Souza"` e `"deliveryInstructions":"Deixar na recepção"`, o botão mostra "Confirmando…", aparece "Pedido #3F1C9A52 recebido", o app vai para a página do pedido e o badge do Carrinho some

### Requirement: Recusas ao confirmar
Uma recusa de `POST /me/orders` SHALL mostrar a mensagem do primeiro código conhecido, com os textos do web: `ORDER_CUSTOMER_REQUIRED` → "Preencha os dados de entrega para confirmar o pedido.", `ORDER_CUSTOMER_INACTIVE` → "Seu cadastro está inativo. Fale com o atendimento.", `ORDER_CART_EMPTY` → "Seu carrinho está vazio.", `ORDER_CART_HAS_UNAVAILABLE_ITEMS` → "Remova os itens indisponíveis para confirmar o pedido.", `ORDER_PRODUCT_NOT_FOUND` → "Um produto do carrinho não está mais disponível.", `TEXT_TOO_SHORT` → "O texto não atingiu o tamanho mínimo permitido." e `TEXT_TOO_LONG` → "O texto passou do tamanho máximo permitido.", entre outros `ORDER_*`. Código desconhecido MUST mostrar "Não foi possível concluir. Tente novamente.", e falhas de rede e do servidor MUST manter as mensagens delas. Depois de qualquer falha, o app MUST continuar no checkout com o que foi digitado, reler o carrinho da conta e, quando o código começar com `ORDER_CUSTOMER_`, consultar o cadastro de novo.

#### Scenario: Produto desativado antes de confirmar
- **WHEN** o cliente confirma e a API responde `400` com `ORDER_CART_HAS_UNAVAILABLE_ITEMS`
- **THEN** aparece "Remova os itens indisponíveis para confirmar o pedido.", `GET /me/cart` é enviado, a linha passa a "Indisponível" e o checkout continua aberto

#### Scenario: Cadastro inativo
- **WHEN** o cliente confirma e a API responde `400` com `ORDER_CUSTOMER_INACTIVE`
- **THEN** aparece "Seu cadastro está inativo. Fale com o atendimento.", o cadastro e o carrinho são consultados de novo e nenhum pedido é criado
