## ADDED Requirements

### Requirement: Carrinho da conta
Com sessão, as linhas e os totais do carrinho SHALL vir do carrinho da conta (`GET /me/cart`), carregado quando a sessão começa. Até a primeira resposta, a aba MUST mostrar o skeleton das linhas, e uma falha nessa carga MUST mostrar o banner "Não foi possível carregar o carrinho." com "Tentar de novo". Incluir MUST enviar `POST /me/cart/items` com `{productId, quantity}`. Definir a quantidade MUST enviar `PUT /me/cart/items/<productId>` com `{quantity}`. Remover, ou definir 0, MUST enviar `DELETE /me/cart/items/<productId>`, e esvaziar MUST enviar `DELETE /me/cart`. As regras de quantidade do visitante MUST ser checadas antes do envio: quando a regra recusa, nada é enviado e o carrinho não muda. A quantidade, o badge e o "Você já tem N no carrinho." MUST mudar na hora, sem esperar a API. Os comandos MUST ser enviados um de cada vez, na ordem em que foram feitos, e o carrinho exibido no fim MUST ser o da última resposta. Enquanto houver comando pendente, o resumo MUST ser sinalizado como em atualização. Se um comando falhar, a mensagem da falha MUST aparecer e o carrinho MUST ser lido de novo da API.

#### Scenario: Abrir com sessão
- **WHEN** o app abre com sessão, sem itens do visitante, e `GET /me/cart` devolve o produto A com quantidade 2
- **THEN** a aba Carrinho mostra A com quantidade 2, o badge mostra 2 e nenhuma prévia de visitante é usada

#### Scenario: Mudança na hora e em ordem
- **WHEN** o cliente toca "+" duas vezes na linha de A, que está com quantidade 2
- **THEN** a quantidade e o badge passam a 4 na hora, saem `PUT /me/cart/items/<A>` com `{"quantity":3}` e depois com `{"quantity":4}`, o segundo só depois da resposta do primeiro, e a aba fica com a última resposta

#### Scenario: Comando recusado
- **WHEN** o cliente adiciona um produto no detalhe e `POST /me/cart/items` responde `404` com `CART_PRODUCT_NOT_FOUND`
- **THEN** aparece "Produto indisponível.", o carrinho é lido de novo por `GET /me/cart` e o badge volta ao valor da resposta

### Requirement: Mescla do carrinho ao entrar
Quando a sessão começa (login, cadastro ou abertura do app com sessão guardada) e há itens no carrinho do visitante, o app SHALL enviá-los por `POST /me/cart/merge` com `{"items": [...]}` e exibir o carrinho devolvido, sem um `GET /me/cart` separado. O carrinho do visitante MUST ser apagado do aparelho só depois de a mescla dar certo. Se a mescla falhar, o app MUST mostrar o carrinho da conta lido por `GET /me/cart`, MUST manter os itens do visitante no aparelho e MUST mostrar na aba Carrinho o aviso "Não foi possível juntar o carrinho deste aparelho à sua conta.", com a mensagem da falha e "Tentar de novo", que tenta a mescla outra vez. Sem itens do visitante, MUST NOT haver mescla.

#### Scenario: Entrar com itens do visitante
- **WHEN** um visitante com A (quantidade 3) e B (quantidade 1) no aparelho entra numa conta que já tinha A com quantidade 2
- **THEN** sai `POST /me/cart/merge` com os dois itens, a aba mostra A com 5 e B com 1, e o aparelho deixa de guardar o carrinho do visitante

#### Scenario: Falha na mescla
- **WHEN** a mescla responde `500` e `GET /me/cart` devolve o carrinho da conta
- **THEN** a aba mostra o carrinho da conta e o aviso da mescla, os itens do visitante continuam no aparelho e "Tentar de novo" envia a mescla de novo

#### Scenario: Entrar sem itens do visitante
- **WHEN** um visitante com o carrinho vazio entra
- **THEN** só `GET /me/cart` é enviado, sem mescla

### Requirement: Volta ao carrinho do visitante ao sair
Quando a sessão termina, seja por "Sair" ou por expiração (`401`), o app SHALL voltar a exibir o carrinho do visitante guardado no aparelho, que fica vazio depois de uma mescla bem-sucedida, e o badge MUST acompanhar. O carrinho da conta MUST continuar no servidor, sem nenhuma chamada para apagá-lo, e MUST voltar a aparecer quando o cliente entrar de novo. Respostas do carrinho da conta que chegarem depois do fim da sessão MUST ser descartadas.

#### Scenario: Sair
- **WHEN** o cliente com 3 itens no carrinho da conta toca em "Sair"
- **THEN** o badge some, a aba Carrinho mostra "Seu carrinho está vazio." e nenhum `DELETE /me/cart` é enviado

#### Scenario: Entrar de novo
- **WHEN** esse cliente entra novamente sem itens do visitante
- **THEN** a aba Carrinho volta a mostrar os 3 itens do carrinho da conta

### Requirement: Mensagens das recusas do carrinho
As recusas do backend nos comandos do carrinho da conta SHALL virar mensagens em português, pelo primeiro código conhecido da resposta: `CART_ITEM_QUANTITY_EXCEEDED` → "Limite de 99 unidades por produto.", `CART_ITEMS_LIMIT_EXCEEDED` → "O carrinho aceita até 50 produtos diferentes.", `CART_ITEM_QUANTITY_INVALID` → "Quantidade inválida." e `CART_PRODUCT_NOT_FOUND` (ou `404` sem código) → "Produto indisponível.". Recusa sem código conhecido MUST mostrar "Não foi possível concluir. Tente novamente.". Falhas de rede, do servidor e de sessão MUST manter as mensagens delas. A mensagem MUST aparecer onde a ação foi feita: na aba Carrinho ou no detalhe do produto.

#### Scenario: Limite pelo servidor
- **WHEN** `PUT /me/cart/items/<A>` responde `400` com `{"message":["CART_ITEM_QUANTITY_EXCEEDED"]}`
- **THEN** a aba Carrinho mostra "Limite de 99 unidades por produto."

#### Scenario: Código desconhecido
- **WHEN** `POST /me/cart/items` responde `400` com `{"message":["ALGO_NOVO"]}`
- **THEN** o detalhe do produto mostra "Não foi possível concluir. Tente novamente."
