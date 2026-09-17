## ADDED Requirements

### Requirement: Loja e categoria na URL
A loja e a categoria selecionadas SHALL ser lidas dos parâmetros de query `loja` (o slug da loja) e `categoria`, com o padrão "todas" para a categoria. As lojas disponíveis MUST ser as lojas ativas da leitura pública (`stores/storefront-stores`), na ordem devolvida por ela.

A loja em vigor MUST ser definida assim:
- `loja` com o slug de uma loja ativa: essa loja;
- `loja` ausente, vazio ou com slug desconhecido: a loja lembrada do navegador quando ela ainda estiver ativa, senão a primeira loja ativa;
- um parâmetro `bairro` na URL MUST ser ignorado, sem erro, para links antigos continuarem abrindo a vitrine.

Escolher uma loja no seletor MUST gravar `loja=<slug>` na URL, lembrar a escolha no navegador para as próximas visitas, atualizar a URL sem adicionar entrada ao histórico e sem recarregar a página, e manter a categoria, a busca, os demais filtros, a ordenação e a página. A memória da escolha MUST ser por navegador, MUST NOT ser enviada à API e, quando indisponível ou ilegível, MUST ser tratada como ausente. Trocar a categoria MUST manter a loja e voltar à página 1. Recarregar a página MUST preservar loja e categoria. Uma categoria desconhecida na URL MUST resultar na listagem vazia, sem erro.

Escolher a loja MUST NOT mudar o catálogo, os preços nem a disponibilidade dos produtos: nesta entrega o catálogo é único.

#### Scenario: URL sem parâmetros
- **WHEN** um visitante sem escolha anterior acessa `/`
- **THEN** a loja em vigor é a primeira loja ativa ("Loja Paulista" com o seed), o chip ativo é "Tudo" e a página inicial da vitrine é exibida

#### Scenario: Escolha da loja no seletor
- **WHEN** o visitante escolhe "Loja Rio Branco" no seletor do cabeçalho
- **THEN** a URL passa a conter `loja=loja-rio-branco`, o seletor passa a mostrar essa loja e a categoria selecionada é mantida

#### Scenario: Escolha lembrada na volta
- **WHEN** o visitante que escolheu "Loja Rio Branco" acessa `/` mais tarde, sem parâmetros
- **THEN** a loja em vigor é "Loja Rio Branco"

#### Scenario: Recarga com parâmetros
- **WHEN** o visitante acessa `/?loja=loja-rio-branco&categoria=cartuchos-toners`
- **THEN** o seletor mostra "Loja Rio Branco" e só produtos de "Cartuchos & Toners" aparecem

#### Scenario: Slug desconhecido
- **WHEN** o visitante acessa `/?loja=loja-que-nao-existe`
- **THEN** a vitrine é exibida na loja padrão, sem erro

#### Scenario: Link antigo com bairro
- **WHEN** o visitante acessa `/?bairro=Bela+Vista&categoria=escrita-corretivos`
- **THEN** a vitrine é exibida na loja padrão ou na lembrada, com a categoria "Escrita & Corretivos", e o parâmetro `bairro` é ignorado

#### Scenario: Catálogo não muda com a loja
- **WHEN** o visitante troca de loja no seletor
- **THEN** os mesmos produtos continuam sendo exibidos, com os mesmos preços

## MODIFIED Requirements

### Requirement: Vitrine na rota raiz
O sistema SHALL servir a vitrine pública na rota `/`, sem exigir sessão, dentro do shell da loja (cabeçalho com logo, seletor de lojas, conta e sacola). O redirect anterior de `/` para `/principal` MUST deixar de existir. A área administrativa MUST viver em `/admin` e exigir sessão de administrador; a rota `/principal` MUST deixar de existir. O título do documento MUST ser "já já.".

#### Scenario: Acesso anônimo à raiz
- **WHEN** um visitante sem sessão acessa `/`
- **THEN** a vitrine é exibida com o cabeçalho da loja e o título do documento "já já."

#### Scenario: Área privada preservada
- **WHEN** um administrador autenticado acessa `/admin`
- **THEN** o dashboard administrativo é exibido no shell administrativo, e `/principal` responde com a página não encontrada

### Requirement: Navegação para o detalhe do produto
Cada card da vitrine SHALL ser um link para `/p/<slug>` que preserva todos os parâmetros atuais da vitrine (loja, categoria, busca, filtros, ordenação e página). A rota `/p/<slug>` SHALL manter o cabeçalho da loja (logo, seletor de lojas, busca e carrinho) e o rodapé compartilhados, e exibir o produto lido da API:
- trilha "Início / <categorias da raiz até a do produto> / <nome>", em que cada categoria leva à listagem dela, mantendo a loja;
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
- **WHEN** o visitante em `/?loja=loja-paulista&categoria=escrita-corretivos&q=caneta` clica no card de uma caneta
- **THEN** navega para `/p/<slug-da-caneta>?loja=loja-paulista&categoria=escrita-corretivos&q=caneta`, continua vendo o cabeçalho da loja com "Loja Paulista", e vê a galeria, o nome, o preço, a trilha de categorias e o link "← Voltar aos resultados"

#### Scenario: Voltar pela trilha
- **WHEN** no detalhe o visitante clica na categoria raiz da trilha
- **THEN** vai para `/?loja=loja-paulista&categoria=<slug-da-raiz>`, com a listagem dessa categoria

#### Scenario: Produto com preço "De:"
- **WHEN** o visitante abre o detalhe de um produto com `priceCents: 1290` e `listPriceCents: 1590`
- **THEN** vê `R$ 12,90`, `R$ 15,90` riscado e o selo `−19%`

#### Scenario: Produto inexistente
- **WHEN** o visitante acessa `/p/nao-existe`
- **THEN** a resposta é a página não encontrada

#### Scenario: Produto inativo
- **WHEN** o visitante acessa `/p/cartucho-lexmark-dual-pack-1un-17-1un-27-10n0595-lexmark-cx-1-un`, produto inativo no seed
- **THEN** a resposta é a página não encontrada

## REMOVED Requirements

### Requirement: Bairro e categoria na URL
**Reason**: O bairro era um dado simulado no frontend e decidia a loja, a cobertura e o tempo de entrega. A área de atuação de uma loja é um raio a partir do ponto dela, que não corresponde a bairros.
**Migration**: Substituída por "Loja e categoria na URL". `?bairro=<nome>` dá lugar a `?loja=<slug>`, e um `bairro` remanescente na URL é ignorado.

### Requirement: Bairro não atendido
**Reason**: Sem bairro não existe mais "bairro fora da área". A cobertura passa a ser decidida pelo raio da loja contra o ponto do endereço do cliente, no fluxo de pedido, e não pela navegação da vitrine.
**Migration**: O estado vazio "Ainda não chegamos aí. Já já." e os bairros `Pinheiros`, `Moema` e `Copacabana` do seletor deixam de existir. Com uma loja escolhida, a vitrine sempre exibe o catálogo, e o "+" dos cards e o "Adicionar" do detalhe deixam de ser bloqueados por cobertura (ver `orders/storefront-cart`). A verificação por raio chega em uma entrega seguinte.
