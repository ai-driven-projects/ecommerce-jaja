## ADDED Requirements

### Requirement: Carrinho do visitante guardado no aparelho
Sem sessão, o app SHALL guardar no aparelho os produtos e as quantidades do carrinho, na ordem de inclusão, no mesmo formato do web (lista de `{productId, quantity}`), e MUST mostrar o mesmo carrinho ao reabrir o app. Ao ler, o conteúdo guardado MUST ser normalizado: entradas sem `productId` texto ou sem quantidade inteira ≥ 1 são descartadas, o `productId` é aparado e posto em minúsculas, quantidades do mesmo produto são somadas na primeira posição e limitadas a 99, e só os primeiros 50 produtos são mantidos. Conteúdo ilegível ou memória indisponível MUST virar carrinho vazio, sem erro. Carrinho vazio MUST apagar o conteúdo guardado.

#### Scenario: Reabrir o app
- **WHEN** o visitante adiciona dois produtos e fecha e reabre o app
- **THEN** a aba Carrinho mostra os dois produtos, nas mesmas quantidades e na mesma ordem

#### Scenario: Conteúdo guardado irregular
- **WHEN** o aparelho guarda `[{"productId":" A ","quantity":60},{"productId":"a","quantity":60},{"productId":"b","quantity":0},{"quantity":2}]`
- **THEN** o carrinho tem só o produto `a` com quantidade 99

#### Scenario: Conteúdo ilegível
- **WHEN** o aparelho guarda um texto que não é JSON
- **THEN** o carrinho abre vazio, sem mensagem de erro

### Requirement: Regras de quantidade do carrinho
Incluir um produto SHALL somar a quantidade à que já está no carrinho, mantendo a posição, ou incluí-lo no fim; definir a quantidade MUST mantê-la na posição e 0 MUST remover o produto. Passar de 99 unidades num produto MUST falhar com "Limite de 99 unidades por produto.", incluir o 51º produto diferente MUST falhar com "O carrinho aceita até 50 produtos diferentes." e quantidade negativa, fracionária ou fora de 1 a 99 ao incluir MUST falhar com "Quantidade inválida."; em toda falha o carrinho MUST continuar como estava. Toda mudança aceita MUST valer na hora (quantidades, badge e armazenamento), sem esperar a API.

#### Scenario: Somar ao que já existe
- **WHEN** o carrinho tem o produto A com quantidade 2 e o visitante adiciona 3 de A
- **THEN** A passa a 5, na mesma posição

#### Scenario: Limite por produto
- **WHEN** o produto A está com 98 e o visitante tenta adicionar 3
- **THEN** a falha "Limite de 99 unidades por produto." é devolvida e A continua com 98

#### Scenario: Limite de produtos
- **WHEN** o carrinho tem 50 produtos diferentes e o visitante adiciona um 51º
- **THEN** a falha "O carrinho aceita até 50 produtos diferentes." é devolvida e o carrinho não muda

### Requirement: Prévia de preços do carrinho
As linhas exibidas (nome, foto, unidade, preço atual, disponibilidade) e os totais SHALL vir de `POST /cart/preview` com `{"items": [...]}`, sem token, pedida 250 ms depois da última mudança do carrinho; mudanças dentro desse intervalo MUST gerar um só pedido, com os itens mais recentes. Carrinho vazio MUST NOT chamar a API e MUST mostrar os totais zerados. Resposta de um pedido já superado por outra mudança MUST ser descartada. Produto que não volta como linha MUST sair do carrinho guardado. Preço e disponibilidade exibidos MUST ser sempre os da última prévia, nunca guardados no aparelho. Se a prévia falhar, as quantidades guardadas MUST continuar como estão.

#### Scenario: Produto que sumiu
- **WHEN** o carrinho tem A e B e a prévia devolve só a linha de A
- **THEN** a aba mostra só A e o aparelho passa a guardar só A

#### Scenario: Preço mudou
- **WHEN** A estava a R$ 12,90 numa prévia e a próxima prévia devolve A a R$ 14,90
- **THEN** a linha mostra `R$ 14,90` e o subtotal é recalculado pela resposta nova

#### Scenario: Mudanças em sequência
- **WHEN** o visitante toca "+" três vezes em A em menos de 250 ms
- **THEN** só uma prévia é pedida, com a quantidade final de A

### Requirement: Linhas da aba Carrinho
A aba Carrinho SHALL mostrar, na ordem de inclusão, cada linha com a foto do produto (ou a ilustração da categoria raiz), o nome, que abre o detalhe do produto, a unidade, o preço unitário, o controle de quantidade com "−" e "+", o total da linha e a ação de remover. "−" com quantidade 1 MUST remover o produto e "+" MUST ficar indisponível em 99. Linha indisponível MUST mostrar "Indisponível" e "Remover", sem controle de quantidade e sem total. Mudança de quantidade ou remoção MUST aparecer na hora.

#### Scenario: Aumentar a quantidade
- **WHEN** a linha de um produto de R$ 12,90 está com quantidade 1 e o visitante toca "+"
- **THEN** a quantidade passa a 2 na hora e o total da linha mostra `R$ 25,80`

#### Scenario: Remover pela quantidade
- **WHEN** o visitante toca "−" no único produto, com quantidade 1
- **THEN** a linha some e aparece o carrinho vazio

#### Scenario: Linha indisponível
- **WHEN** a prévia devolve um produto com `isAvailable: false`
- **THEN** a linha mostra "Indisponível" e "Remover", sem "−", "+" nem total

### Requirement: Resumo e entrega do carrinho
Abaixo das linhas, a aba SHALL mostrar o subtotal, a entrega ("Grátis" quando a taxa é 0, senão o valor), "Faltam <valor> para a entrega grátis." enquanto a entrega é cobrada, o total, todos da prévia, e a ação principal "Finalizar pedido · <total>", visível e desabilitada até o checkout existir. Com linhas indisponíveis, MUST aparecer "Remova os itens indisponíveis para continuar.". Enquanto uma mudança não foi confirmada por uma prévia, os valores MUST ser sinalizados como em atualização.

#### Scenario: Entrega cobrada
- **WHEN** a prévia devolve subtotal 2580, entrega 490, total 3070 e faltam 5320 centavos
- **THEN** a aba mostra `R$ 25,80`, `R$ 4,90`, "Faltam R$ 53,20 para a entrega grátis." e "Finalizar pedido · R$ 30,70"

#### Scenario: Entrega grátis
- **WHEN** a prévia devolve subtotal 7900 e entrega 0
- **THEN** a entrega aparece como "Grátis" e o aviso de quanto falta não aparece

### Requirement: Estados da aba Carrinho
Com itens guardados e nenhuma linha ainda (abertura do app ou primeira prévia), a aba SHALL mostrar um skeleton das linhas. Se a prévia falhar, MUST mostrar o banner "Não foi possível carregar o carrinho." com a mensagem da falha e "Tentar de novo", que pede a prévia de novo. Sem itens, MUST mostrar o estado vazio "Seu carrinho está vazio." com "Adicione itens para o escritório!" e a única ação "Ver produtos", que abre a aba Buscar sem filtros.

#### Scenario: Carrinho vazio
- **WHEN** o visitante abre a aba Carrinho sem itens
- **THEN** aparece "Seu carrinho está vazio." e, ao tocar em "Ver produtos", a aba Buscar é exibida sem filtros

#### Scenario: Falha e nova tentativa
- **WHEN** a prévia responde `500` e o visitante toca em "Tentar de novo"
- **THEN** a aba mostra "Não foi possível carregar o carrinho." e a prévia é pedida de novo

### Requirement: Badge da aba Carrinho
A aba Carrinho da barra SHALL mostrar um badge com a soma das quantidades do carrinho, inclusive de linhas indisponíveis, atualizada na hora a cada mudança; sem itens, o badge MUST NOT aparecer, e acima de 99 MUST mostrar "99+".

#### Scenario: Badge atualizado
- **WHEN** o carrinho tem um produto com quantidade 2 e o visitante adiciona 1 unidade de outro no detalhe
- **THEN** o badge passa de 2 para 3 antes da resposta da prévia
