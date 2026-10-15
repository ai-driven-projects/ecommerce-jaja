## ADDED Requirements

### Requirement: Busca por texto
A aba Buscar SHALL ter um campo de busca no topo, com a dica "Buscar produtos" e o termo em vigor. Digitar MUST aplicar o termo (sem espaços nas pontas) só depois de 300 ms sem nova digitação; confirmar pelo teclado MUST aplicar na hora. Um botão "Limpar busca", visível só com texto, MUST esvaziar o campo e remover o termo na hora. Aplicar um termo MUST manter categoria, filtros e ordenação escolhida, salvo "Mais relevantes", que volta à ordem padrão quando o termo fica vazio.

#### Scenario: Espera da digitação
- **WHEN** a pessoa digita "cane" e, 100 ms depois, "caneta", e para de digitar
- **THEN** nenhuma busca sai antes de 300 ms após a última tecla, e sai uma só, com `search=caneta`

#### Scenario: Confirmar pelo teclado
- **WHEN** a pessoa digita "toner" e confirma pelo teclado antes dos 300 ms
- **THEN** a busca com `search=toner` sai na hora e não se repete quando o tempo de espera acabaria

#### Scenario: Limpar a busca ordenada por relevância
- **WHEN** a busca "toner" está ordenada por "Mais relevantes" e a pessoa toca em "Limpar busca"
- **THEN** o campo fica vazio e a listagem é pedida sem `search` e sem `sort`

### Requirement: Título e contagem da listagem
A listagem SHALL ter um título, nesta prioridade: `Resultados para “<termo>”`; o nome da categoria filtrada (procurada em toda a árvore; "…" enquanto a árvore carrega; "Produtos" se o slug não existir); "Em destaque"; "Ofertas"; ou "Produtos". Abaixo do título MUST aparecer o total de produtos encontrados ("1 produto", "24 produtos"), ou "…" enquanto a primeira página carrega.

#### Scenario: Subcategoria filtrada
- **WHEN** a Buscar abre com a categoria `toners-hp` e a árvore já carregada, e a API informa `total: 12`
- **THEN** o título é "Toners HP" e a contagem é "12 produtos"

#### Scenario: Busca tem prioridade
- **WHEN** há o termo "caneta" e o filtro "só ofertas"
- **THEN** o título é "Resultados para “caneta”"

### Requirement: Filtros no painel inferior
O botão "Filtros (n)", em que n é a quantidade de pílulas de filtro ativo, SHALL abrir um painel inferior "Filtros" com os grupos:
- **Categoria:** "Todas as categorias" e a árvore inteira em pré-ordem, recuada por nível, com a quantidade de produtos, de escolha única;
- **Marca:** as marcas do resultado com a contagem, de escolha múltipla, oito visíveis e "Ver todas (N)"/"Ver menos" quando houver mais; marca escolhida fora do resultado aparece marcada no topo; sem marcas, "Nenhuma marca neste resultado.";
- **Preço:** "Mínimo (R$)" e "Máximo (R$)" em reais (aceitando `12,90`, `12.90`, `1.290,90` e `300`), aplicados pelo botão "Aplicar"; valor inválido MUST mostrar "Use valores em reais, como 12,90." e não aplicar nada;
- **Ofertas e destaques:** "Só ofertas" e "Só destaques".

Cada mudança MUST valer na hora, com a listagem recarregando por trás do painel. O rodapé do painel MUST ter "Limpar filtros" (só com filtro ativo) e a ação principal "Ver N produtos" ("Ver produtos" enquanto carrega), que fecha o painel. Se a árvore de categorias falhar, o grupo Categoria MUST mostrar o banner de erro com "Tentar de novo", sem bloquear os outros grupos.

#### Scenario: Marca e preço
- **WHEN** na busca "toner" a pessoa marca a marca HP e aplica o máximo `300`
- **THEN** a listagem é pedida com `search=toner`, `brand=hp` e `maxPriceCents=30000`, e o botão passa a "Filtros (2)"

#### Scenario: Preço inválido
- **WHEN** a pessoa digita `12,999` no mínimo e toca em "Aplicar"
- **THEN** aparece "Use valores em reais, como 12,90." e nenhuma nova busca sai

#### Scenario: Categoria pelo painel
- **WHEN** a pessoa escolhe "Toners HP" no grupo Categoria
- **THEN** a listagem é pedida com `category=toners-hp` e o grupo mostra "Toners HP" marcada

### Requirement: Ordenação
Um botão com a ordem efetiva SHALL abrir um painel inferior "Ordenar por" com "Mais relevantes" (só com termo de busca), "Destaques", "Menor preço", "Maior preço", "Nome (A–Z)" e "Maior desconto", que correspondem a `relevance`, `featured`, `price-asc`, `price-desc`, `name` e `discount`. Sem escolha, a ordem efetiva MUST ser "Mais relevantes" com termo e "Destaques" sem, e `sort` MUST NOT ser enviado. Escolher uma ordem MUST fechar o painel e recarregar a listagem com ela.

#### Scenario: Ordem padrão
- **WHEN** a Buscar abre sem termo e sem ordem escolhida
- **THEN** o botão mostra "Destaques", o painel não oferece "Mais relevantes" e a requisição não tem `sort`

#### Scenario: Escolher menor preço
- **WHEN** a pessoa escolhe "Menor preço"
- **THEN** o painel fecha e a listagem é pedida com `sort=price-asc`

### Requirement: Filtros ativos em pílulas
Com filtro ativo, a página SHALL mostrar, abaixo do título, uma pílula por filtro: a categoria (pelo nome), cada marca (pelo nome da faceta ou, sem faceta, pelo slug), o preço ("R$ 12,90 a R$ 300,00", "a partir de R$ 12,90" ou "até R$ 300,00"), "Só ofertas" e "Só destaques". Tocar numa pílula MUST remover só aquele filtro; "Limpar filtros" MUST remover categoria, marcas, preço, ofertas e destaques, mantendo o termo de busca e a ordem.

#### Scenario: Remover uma pílula
- **WHEN** estão ativos a marca HP e "Só ofertas" e a pessoa toca na pílula "Só ofertas"
- **THEN** a listagem é pedida com `brand=hp` e sem `onSale`

#### Scenario: Limpar filtros
- **WHEN** com o termo "caneta", a ordem "Menor preço", a categoria `escolar` e a marca `bic`, a pessoa toca em "Limpar filtros"
- **THEN** a listagem é pedida com exatamente `search=caneta`, `sort=price-asc`, `page=1` e `pageSize=24`, e nenhuma pílula aparece

### Requirement: Paginação infinita
A listagem SHALL pedir 24 produtos por página (`page`, `pageSize=24`), começando da página 1, em grade de duas colunas. Ao rolar até perto do fim, a próxima página MUST ser pedida e seus itens acrescentados ao fim, sem repetir produto já exibido; enquanto ela carrega, o rodapé mostra um skeleton. Quando a última página (`totalPages`) já foi carregada, nenhuma nova página MUST ser pedida. Se a página seguinte falhar, os itens já exibidos MUST permanecer e só o rodapé MUST mostrar o banner "Não foi possível carregar mais produtos." com "Tentar de novo", que pede a mesma página de novo.

#### Scenario: Segunda página
- **WHEN** a primeira página tem 24 itens de `totalPages: 3` e a pessoa rola até o fim
- **THEN** sai uma requisição com `page=2` e `pageSize=24`, e a grade passa a ter 48 itens

#### Scenario: Fim da lista
- **WHEN** a página carregada é a última e a pessoa rola até o fim
- **THEN** nenhuma requisição nova sai

#### Scenario: Falha na página seguinte
- **WHEN** a página 2 falha
- **THEN** os 24 primeiros itens continuam na tela, o rodapé mostra "Não foi possível carregar mais produtos." e "Tentar de novo" pede a página 2 de novo

### Requirement: Troca de filtro reinicia a listagem
Qualquer mudança de termo, categoria, marca, preço, ofertas, destaques ou ordem SHALL recomeçar a listagem da página 1, voltar a rolagem ao topo e mostrar o skeleton da grade no lugar dos itens anteriores. A resposta de um pedido feito com um filtro que já não está em vigor MUST ser descartada, tanto da primeira página quanto da seguinte. Aplicar um filtro igual ao em vigor MUST NOT fazer nova requisição.

#### Scenario: Resposta atrasada descartada
- **WHEN** a busca "caneta" ainda não respondeu e a pessoa troca para "toner", e a resposta de "caneta" chega depois da de "toner"
- **THEN** a grade mostra só o resultado de "toner"

#### Scenario: Volta à página 1
- **WHEN** a página 2 já foi carregada e a pessoa marca "Só ofertas"
- **THEN** sai uma requisição com `page=1` e `onSale=true`, e a grade mostra só o resultado dela

### Requirement: Estados da listagem
Enquanto a primeira página carrega, a grade SHALL ser substituída por seis cartões de skeleton. Se ela falhar, a grade MUST dar lugar ao banner "Não deu para carregar os produtos." com a mensagem da falha e "Tentar de novo", que pede a página 1 de novo. Sem resultados, a página MUST mostrar "Nada por aqui. Já já." com "Tente limpar os filtros ou buscar outro termo." e uma ação: "Limpar filtros" com filtro ativo; senão "Limpar busca" com termo; senão "Atualizar". Puxar a tela MUST recarregar as categorias e a listagem desde a página 1. Tocar num produto MUST abrir o detalhe dele.

#### Scenario: Sem resultados com termo
- **WHEN** a busca "xyzabc" volta vazia, sem filtro ativo
- **THEN** aparece "Nada por aqui. Já já." e a ação "Limpar busca", que esvazia o campo e recarrega sem `search`

#### Scenario: Falha da primeira página
- **WHEN** a API responde `500` na primeira página
- **THEN** a página mostra "Não deu para carregar os produtos." e, ao tocar em "Tentar de novo", a página 1 é pedida de novo com o mesmo filtro
