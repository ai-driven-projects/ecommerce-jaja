## Purpose

Define o conteúdo da aba Início do app mobile do cliente Jajá, os estados de cada bloco remoto e para onde cada toque leva.

## ADDED Requirements

### Requirement: Conteúdo da aba Início
A aba Início SHALL mostrar, nesta ordem, numa única rolagem vertical: o seletor de loja; a linha rolável de chips com "Tudo" e as categorias raiz com produtos, na ordem da API, cada uma com o emoji da raiz; o hero da marca com a pílula "De bike e a pé, saindo da <loja em vigor>" (ou "De bike e a pé até você" sem loja), o título "Acabou no escritório? Chega em minutos." e o parágrafo da vitrine, sem contagem de entregadores nem pedidos fictícios; "Em destaque" com até 12 produtos em destaque; "Ofertas da semana" com até 8 produtos com preço "De:", do maior para o menor desconto; "Categorias em destaque" com até 12 categorias em destaque, cada uma com o emoji da raiz, o nome e "N produtos". Cada seção de produtos MUST ter "Ver tudo →" e mostrar os cards com foto (ou a reserva da raiz), nome, unidade, preço, preço anterior e o selo de desconto ou "Destaque". Uma seção sem itens MUST NOT ser exibida. A loja escolhida MUST NOT mudar o conteúdo.

#### Scenario: Início com o catálogo do seed
- **WHEN** a API devolve 12 destaques, 8 ofertas e uma árvore com categorias em destaque
- **THEN** a Início mostra os chips das raízes, o hero com "saindo da Loja Paulista", "Em destaque" com 12 cards, "Ofertas da semana" com 8 cards com `−N%` e "Categorias em destaque" com os nomes e "N produtos"

#### Scenario: Sem ofertas
- **WHEN** a API devolve zero produtos em oferta e os demais blocos com itens
- **THEN** "Ofertas da semana" não aparece e as outras seções aparecem normalmente

### Requirement: Estados dos blocos da Início
Cada bloco remoto da Início (categorias, destaques, ofertas) SHALL seguir o padrão de tela remota de forma independente: skeleton no formato do bloco enquanto carrega, inclusive ao tentar de novo; em falha, o banner de erro com título próprio ("Não foi possível carregar as categorias.", "…os destaques.", "…as ofertas."), a mensagem da falha e "Tentar de novo", substituindo só aquele bloco e refazendo só a busca dele; a falha das categorias MUST mostrar um único banner, na posição da linha de chips, e esconder "Categorias em destaque". Com os três blocos carregados e vazios, a Início MUST mostrar, no lugar das seções, o estado vazio "Nada por aqui. Já já." com a ação única "Ver catálogo", que abre a aba Buscar sem filtros. Puxar a tela para baixo MUST refazer todas as buscas, inclusive a das lojas.

#### Scenario: Falha só nas ofertas
- **WHEN** a busca das ofertas falha por rede e as outras duas respondem
- **THEN** "Em destaque" e as categorias aparecem, no lugar das ofertas aparece o banner "Não foi possível carregar as ofertas." com "Tentar de novo", e o toque refaz só a busca das ofertas

#### Scenario: Catálogo vazio
- **WHEN** a API devolve árvore vazia e páginas sem itens
- **THEN** a Início mostra "Nada por aqui. Já já." com "Ver catálogo", e nenhuma seção

#### Scenario: Puxar para atualizar
- **WHEN** a pessoa puxa a Início para baixo com tudo carregado
- **THEN** as lojas, as categorias (sem reaproveitar a árvore), os destaques e as ofertas são buscados de novo

### Requirement: Navegação a partir da Início
Tocar num chip de categoria raiz ou num cartão de "Categorias em destaque" SHALL abrir a aba Buscar filtrada por aquela categoria; "Tudo" SHALL abrir a Buscar sem filtros; "Ver tudo →" de "Em destaque" SHALL abrir a Buscar só com destaques, e o de "Ofertas da semana" SHALL abrir a Buscar só com ofertas ordenadas por maior desconto. Tocar num card de produto SHALL abrir a tela do produto por slug, sobre a Início, com a barra de abas visível e um botão de voltar à Início.

#### Scenario: Toque numa categoria
- **WHEN** a pessoa toca no chip "Escolar" ou no cartão "Toners HP"
- **THEN** a aba Buscar abre com o filtro de categoria `escolar` (ou `toners-hp`) na rota

#### Scenario: Ver todas as ofertas
- **WHEN** a pessoa toca em "Ver tudo →" de "Ofertas da semana"
- **THEN** a aba Buscar abre com `onSale=true` e `sort=discount` na rota

#### Scenario: Toque num produto
- **WHEN** a pessoa toca no card de um produto de slug `caneta-x`
- **THEN** a rota do produto `caneta-x` abre sobre a Início, a barra de abas continua visível e o botão de voltar retorna à Início
