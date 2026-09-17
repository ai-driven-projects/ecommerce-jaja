# Vitrine (Storefront) Specification

## Purpose

Define o comportamento da vitrine pública do Jaja na rota `/`: o catálogo real exibido a partir da API, como o visitante escolhe bairro e categoria, busca, filtra e ordena produtos, o que vê quando o bairro é atendido ou não, o detalhe do produto e a passagem do carrinho para o checkout. O carrinho na loja é definido em `orders/storefront-cart`.

## Requirements

### Requirement: Vitrine na rota raiz
O sistema SHALL servir a vitrine pública na rota `/`, sem exigir sessão, dentro do shell da loja (cabeçalho com logo, bairro, ETA e sacola). O redirect anterior de `/` para `/principal` MUST deixar de existir. A área administrativa MUST viver em `/admin` e exigir sessão de administrador; a rota `/principal` MUST deixar de existir. O título do documento MUST ser "já já.".

#### Scenario: Acesso anônimo à raiz
- **WHEN** um visitante sem sessão acessa `/`
- **THEN** a vitrine é exibida com o cabeçalho da loja e o título do documento "já já."

#### Scenario: Área privada preservada
- **WHEN** um administrador autenticado acessa `/admin`
- **THEN** o dashboard administrativo é exibido no shell administrativo, e `/principal` responde com a página não encontrada

### Requirement: Catálogo a partir da API
A vitrine e o detalhe do produto SHALL exibir o catálogo real lido da API pública da loja (`catalog/storefront-api`): produtos, categorias, marcas, preços e imagens visíveis. Os dados fictícios de produtos e categorias MUST NOT ser exibidos na vitrine nem no detalhe. Os bairros atendidos, agrupados por loja, e o tempo estimado de entrega por bairro continuam locais nesta entrega.

#### Scenario: Catálogo carregado
- **WHEN** a vitrine é exibida para um bairro atendido
- **THEN** os produtos exibidos são produtos do catálogo cadastrado, com a foto principal, o nome e o preço gravados no banco

#### Scenario: Produto criado no admin
- **WHEN** um administrador cria um produto ativo e o marca como destaque
- **THEN** o produto passa a aparecer na vitrine, na seção "Em destaque", sem nenhuma alteração no frontend

### Requirement: Categorias e subcategorias na vitrine
A vitrine SHALL exibir uma linha de chips com "Tudo" seguido das categorias raiz que têm produtos visíveis, na ordem da API, cada uma com seu emoji. Quando a categoria selecionada tiver subcategorias, uma segunda linha MUST exibir "Tudo em <categoria>" e as subcategorias com a quantidade de produtos. Ao selecionar uma neta, as linhas da raiz e do pai MUST continuar visíveis, com os chips correspondentes ativos.

#### Scenario: Selecionar uma raiz
- **WHEN** o visitante clica no chip "Escrita e Corretivos"
- **THEN** a URL passa a conter `categoria=escrita-corretivos`, o chip fica ativo e aparece a segunda linha com "Tudo em Escrita e Corretivos" e as subcategorias

#### Scenario: Selecionar uma subcategoria
- **WHEN** na segunda linha o visitante clica em uma subcategoria
- **THEN** a URL passa a conter o slug dessa subcategoria, a listagem mostra só os produtos dela e de suas descendentes, e a raiz continua ativa na primeira linha

### Requirement: Página inicial da vitrine
Sem busca, sem filtros e com a categoria "todas", a vitrine SHALL exibir, nesta ordem:
1. o hero;
2. "Em destaque": até 12 produtos em destaque, com "Ver tudo →" levando à listagem só de destaques;
3. "Ofertas da semana": até 8 produtos com preço "De:", do maior para o menor desconto, em cards maiores, com "Ver tudo →" levando à listagem de ofertas ordenada por desconto;
4. "Categorias em destaque": até 12 categorias marcadas como destaque e com produtos, cada uma com o emoji da sua raiz, o nome e "N produtos", levando à listagem da categoria.

Uma seção sem itens MUST NOT ser exibida. As seções "Mais pedidos nos escritórios" e "Repor agora" MUST deixar de existir.

#### Scenario: Página inicial com o seed
- **WHEN** o visitante acessa `/` com o catálogo do seed
- **THEN** vê o hero, 12 produtos em "Em destaque", 8 ofertas com o selo de desconto e as categorias em destaque

#### Scenario: Ver todas as ofertas
- **WHEN** o visitante clica em "Ver tudo →" de "Ofertas da semana"
- **THEN** a URL passa a conter `ofertas=1&ordem=desconto` e a listagem exibe os 96 produtos em oferta, paginados

### Requirement: Bairro e categoria na URL
O bairro e a categoria selecionados SHALL ser lidos dos parâmetros de query `bairro` e `categoria`, com padrões "Bela Vista" e "todas". A categoria MUST ser identificada pelo slug de uma categoria do catálogo. Trocar o bairro no cabeçalho ou a categoria nos chips MUST atualizar a URL sem adicionar entrada ao histórico e sem recarregar a página. Trocar a categoria MUST manter o bairro, a busca, os demais filtros e a ordenação, e voltar à página 1. Recarregar a página MUST preservar a seleção. Uma categoria desconhecida na URL MUST resultar na listagem vazia, sem erro.

#### Scenario: URL sem parâmetros
- **WHEN** o visitante acessa `/`
- **THEN** o bairro exibido é "Bela Vista", o chip ativo é "Tudo" e a página inicial da vitrine é exibida

#### Scenario: Filtro por categoria
- **WHEN** o visitante clica no chip "Cartuchos & Toners"
- **THEN** a URL passa a conter `categoria=cartuchos-toners`, apenas produtos dessa categoria e de suas subcategorias são exibidos, e o chip fica ativo

#### Scenario: Recarga com parâmetros
- **WHEN** o visitante acessa `/?bairro=Consolação&categoria=cartuchos-toners`
- **THEN** o seletor mostra "Consolação", só produtos de "Cartuchos & Toners" aparecem e o ETA de Consolação é exibido

#### Scenario: Troca de bairro
- **WHEN** o visitante escolhe "Centro" no seletor
- **THEN** a URL passa a conter `bairro=Centro`, o ETA exibido é o de Centro e a categoria selecionada é mantida

#### Scenario: Categoria antiga na URL
- **WHEN** o visitante acessa `/?categoria=papelaria`
- **THEN** a listagem exibe o estado sem resultados, sem erro

### Requirement: Bairro não atendido
Quando o bairro selecionado não pertencer a nenhuma loja, a vitrine SHALL ocultar filtros e grade e exibir o estado vazio: o título em display "Ainda não chegamos aí. Já já." com o ponto final em vermelho, o texto "Por enquanto atendemos:" e a lista dos bairros atendidos agrupados por loja (nome da loja em caixa alta com régua de 2px), cada bairro clicável. O cabeçalho MUST omitir o ETA. Os bairros não atendidos `Pinheiros`, `Moema` e `Copacabana` MUST constar no seletor para permitir esse fluxo.

#### Scenario: Bairro fora da área
- **WHEN** o visitante acessa `/?bairro=Pinheiros`
- **THEN** nenhum produto é exibido, o título "Ainda não chegamos aí. Já já." aparece com o ponto em vermelho e os bairros atendidos aparecem agrupados por loja

#### Scenario: Escolher bairro atendido pelo estado vazio
- **WHEN** no estado vazio o visitante clica em "Bela Vista"
- **THEN** a URL passa a conter `bairro=Bela+Vista` e a grade de produtos volta a ser exibida

### Requirement: Navegação para o detalhe do produto
Cada card da vitrine SHALL ser um link para `/p/<slug>` que preserva todos os parâmetros atuais da vitrine (bairro, categoria, busca, filtros, ordenação e página). A rota `/p/<slug>` SHALL manter o cabeçalho da loja (logo, bairro, ETA, busca e carrinho) e o rodapé compartilhados, e exibir o produto lido da API:
- trilha "Início / <categorias da raiz até a do produto> / <nome>", em que cada categoria leva à listagem dela, mantendo o bairro;
- o link "← Voltar aos resultados" quando a URL tiver busca ou filtros;
- os selos "Em destaque" e de desconto, quando se aplicam;
- a marca como link para a listagem da marca;
- o nome, a unidade e "Cód. <sku>";
- o preço, com o preço "De:" riscado quando houver;
- o cartão de entrega;
- "Sobre o produto": a descrição com quebras de linha preservadas, recolhida com "Ler mais"/"Ler menos" quando longa;
- a ficha com marca, categoria, código e unidade;
- "Mais de <categoria>": até 4 outros produtos da mesma categoria.

O título do documento MUST ser "<nome> — já já". Um slug inexistente ou de produto não visível MUST resultar na página não encontrada. Dados inventados de estoque e ficha técnica MUST NOT ser exibidos.

#### Scenario: Clique no card
- **WHEN** o visitante em `/?bairro=Bela+Vista&categoria=escrita-corretivos&q=caneta` clica no card de uma caneta
- **THEN** navega para `/p/<slug-da-caneta>?bairro=Bela+Vista&categoria=escrita-corretivos&q=caneta`, continua vendo o cabeçalho da loja com "Bela Vista", e vê a galeria, o nome, o preço, a trilha de categorias e o link "← Voltar aos resultados"

#### Scenario: Voltar pela trilha
- **WHEN** no detalhe o visitante clica na categoria raiz da trilha
- **THEN** vai para `/?bairro=Bela+Vista&categoria=<slug-da-raiz>`, com a listagem dessa categoria

#### Scenario: Produto com preço "De:"
- **WHEN** o visitante abre o detalhe de um produto com `priceCents: 1290` e `listPriceCents: 1590`
- **THEN** vê `R$ 12,90`, `R$ 15,90` riscado e o selo `−19%`

#### Scenario: Produto inexistente
- **WHEN** o visitante acessa `/p/nao-existe`
- **THEN** a resposta é a página não encontrada

#### Scenario: Produto inativo
- **WHEN** o visitante acessa `/p/cartucho-lexmark-dual-pack-1un-17-1un-27-10n0595-lexmark-cx-1-un`, produto inativo no seed
- **THEN** a resposta é a página não encontrada

### Requirement: Fechar pedido leva ao checkout
O botão "Finalizar pedido" do carrinho SHALL fechar o painel do carrinho e navegar para `/checkout` preservando todos os parâmetros atuais da vitrine (bairro, categoria, busca, filtros, ordenação e página). A navegação MUST NOT depender de sessão: quem não estiver autenticado é identificado na própria página de checkout, e os itens do carrinho do visitante seguem para a conta ao entrar (`orders/storefront-cart`). O botão MUST ficar indisponível quando o carrinho está vazio, quando tem itens indisponíveis ou enquanto uma mudança no carrinho não foi confirmada.

#### Scenario: Fechar pedido com bairro e categoria
- **WHEN** um visitante com itens no carrinho em `/?bairro=Consolação&categoria=escrita-corretivos` clica em "Finalizar pedido"
- **THEN** o painel do carrinho fecha e a página passa a `/checkout?bairro=Consolação&categoria=escrita-corretivos`

#### Scenario: Fechar pedido sem sessão
- **WHEN** um visitante sem sessão, com itens no carrinho, clica em "Finalizar pedido"
- **THEN** chega a `/checkout` e vê o formulário de entrar/criar conta, sem ser redirecionado para `/entrar`

#### Scenario: Carrinho vazio
- **WHEN** o visitante abre o carrinho sem itens
- **THEN** o botão "Finalizar pedido" está indisponível

### Requirement: Busca de produtos pelo cabeçalho
O campo de busca do cabeçalho da loja SHALL buscar produtos. Enviar um termo, com Enter ou pelo botão da lupa, MUST navegar para `/` com `q=<termo>`, mantendo o `bairro` e descartando categoria, filtros, ordenação e página. Enviar o campo vazio MUST remover `q`. O campo MUST exibir o termo presente na URL, inclusive após recarregar, e oferecer um botão para limpar o texto. A busca MUST funcionar também a partir do detalhe do produto.

#### Scenario: Buscar a partir da vitrine filtrada
- **WHEN** o visitante em `/?bairro=Consolação&categoria=escolar&ordem=menor-preco` busca "caneta bic"
- **THEN** a URL passa a ser `/?bairro=Consolação&q=caneta+bic`, e a listagem exibe "Resultados para “caneta bic”" com as canetas da BIC

#### Scenario: Recarregar a busca
- **WHEN** o visitante recarrega `/?q=toner`
- **THEN** o campo de busca exibe "toner" e a listagem mostra os mesmos resultados

#### Scenario: Buscar a partir do detalhe
- **WHEN** o visitante, no detalhe de um produto, busca "papel"
- **THEN** navega para a listagem `/?q=papel` mantendo o bairro

### Requirement: Listagem com filtros, ordenação e paginação na URL
Com busca, filtros ou uma categoria diferente de "todas", a vitrine SHALL exibir a listagem de produtos, com todo o estado na URL.

**Parâmetros da URL:**
- `q`: termo de busca;
- `categoria`;
- `marca`: slugs separados por vírgula;
- `precoMin` e `precoMax`: em reais, aceitando vírgula;
- `ofertas=1` e `destaques=1`;
- `ordem`: `relevancia`, `destaques`, `menor-preco`, `maior-preco`, `nome` ou `desconto`;
- `pagina`.

Valores inválidos MUST ser ignorados, e valores padrão MUST NOT aparecer na URL.

**Cabeçalho:**
- o título MUST ser, nesta prioridade: `Resultados para “<q>”`; o nome da categoria, com as ancestrais clicáveis; "Em destaque"; ou "Ofertas";
- abaixo do título, a quantidade de produtos encontrados.

**Filtros:**
- **Marca:** caixas de seleção com a contagem de cada marca;
- **Preço:** mínimo e máximo em reais, aplicados por botão;
- **Só ofertas** e **Só destaques**.

Os filtros ficam numa coluna lateral em telas largas e num painel aberto pelo botão "Filtros (n)" em telas estreitas.

**Ordenação:** "Mais relevantes" (só com busca), "Destaques", "Menor preço", "Maior preço", "Nome (A–Z)" e "Maior desconto".

**Filtros ativos:** exibidos como pílulas removíveis, com a ação "Limpar filtros", que preserva `bairro` e `q`.

**Navegação:**
- trocar filtro, categoria ou ordenação MUST voltar à página 1 e atualizar a URL sem nova entrada no histórico;
- trocar de página MUST criar entrada no histórico e levar ao topo da listagem.

**Estados:**
- sem resultados, a listagem MUST exibir "Nada por aqui. Já já." com a sugestão de limpar os filtros ou buscar outro termo;
- em falha da API, uma mensagem com a ação "Tentar de novo".

#### Scenario: Filtrar por marca e preço
- **WHEN** na busca "toner" o visitante marca a marca HP e aplica preço máximo `300`
- **THEN** a URL passa a conter `q=toner&marca=hp&precoMax=300`, a listagem exibe só toners HP de até R$ 300,00 e aparecem as pílulas "HP" e "até R$ 300,00"

#### Scenario: Recarregar e voltar
- **WHEN** o visitante recarrega `/?categoria=cartuchos-toners&ordem=maior-preco&pagina=2` e depois usa o "voltar" do navegador após ir à página 3
- **THEN** a recarga reproduz a página 2 da categoria em ordem de maior preço, e o "voltar" retorna à página 2

#### Scenario: Limpar filtros
- **WHEN** o visitante em `/?bairro=Centro&q=caneta&marca=bic&ofertas=1` clica em "Limpar filtros"
- **THEN** a URL passa a ser `/?bairro=Centro&q=caneta`

#### Scenario: Sem resultados
- **WHEN** o visitante busca "xyzabc"
- **THEN** a listagem exibe "Nada por aqui. Já já." e a sugestão de limpar os filtros ou buscar outro termo

#### Scenario: Filtros em tela estreita
- **WHEN** a listagem é exibida em uma janela de 375px
- **THEN** os filtros ficam ocultos atrás do botão "Filtros (n)", que abre um painel com os mesmos controles

### Requirement: Galeria de imagens do produto
O detalhe do produto SHALL exibir todas as imagens do produto numa galeria:
- **Imagem principal:** a grande, com o selo de tempo de entrega quando o bairro é atendido.
- **Com mais de uma imagem:**
  - botões "anterior" e "próxima" e o contador "<atual>/<total>";
  - miniaturas de todas as imagens, roláveis na horizontal, com a ativa destacada;
  - clicar numa miniatura MUST trocar a imagem principal, e as setas do teclado MUST navegar entre as miniaturas.
- **Com uma imagem:** sem miniaturas, setas ou contador.
- **Sem imagens:** a ilustração da categoria.

#### Scenario: Produto com 10 imagens
- **WHEN** o visitante abre `/p/cabeca-de-impressao-magenta-ciano-c9383a-hp-cx-1-un` e clica em "próxima" três vezes
- **THEN** a galeria exibe 10 miniaturas, a quarta imagem como principal, a quarta miniatura destacada e o contador "4/10"

#### Scenario: Teclado
- **WHEN** o foco está numa miniatura e o visitante pressiona a seta para a direita
- **THEN** a miniatura seguinte recebe o foco e sua imagem passa a ser a principal
