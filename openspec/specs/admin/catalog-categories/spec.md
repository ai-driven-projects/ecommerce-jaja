# Categorias na Área Administrativa (Catalog Categories) Specification

## Purpose

Define as telas da área administrativa do Jaja para manter as categorias do catálogo: acesso pelo menu, árvore paginada com preferência recolhida/expandida, busca, criação (inclusive de subcategorias a partir da lista), edição, exclusão, o seletor de categoria com busca na API (também usado nas telas de produtos) e a exibição dos erros da API.

## Requirements

### Requirement: Item "Categorias" no menu do Catálogo
O módulo Catálogo ("Catálogo de Produtos"), no menu lateral da área administrativa, SHALL exibir o sub-item "Categorias" logo após "Marcas", sem rótulo de seção, apontando para `/admin/catalog/categories`. O item MUST ficar ativo nessa rota e em todas as rotas abaixo dela, sendo o único item destacado do menu.

#### Scenario: Item visível e ativo
- **WHEN** um administrador acessa `/admin/catalog/categories/new`
- **THEN** o menu do Catálogo mostra "Visão geral", "Marcas" e "Categorias", nessa ordem e sem o rótulo "Cadastros", com apenas "Categorias" marcado como ativo

### Requirement: Árvore paginada de categorias
A rota `/admin/catalog/categories`, sem texto de busca, SHALL exibir as categorias como uma árvore em formato de tabela, paginada por departamento: cada página traz até 20 categorias raiz, cada uma com suas descendentes logo abaixo, sem dividir uma subárvore entre páginas. A tabela MUST ter as colunas Nome, Slug, Ordem, Status e Ações; cada linha MUST ter recuo proporcional ao nível, o selo "Destaque" ao lado do nome quando a categoria estiver em destaque, o status "Ativa"/"Inativa" e as ações editar e excluir. As linhas de nível 1 e 2 MUST oferecer a ação "Nova subcategoria"; as de nível 3 MUST NOT oferecê-la. Irmãs MUST aparecer ordenadas por `order` e, em empate, por nome.

O cabeçalho MUST exibir o título "Categorias", o total de departamentos ("<n> departamento(s) no catálogo"), o botão "Nova categoria" e o controle de exibição recolhida/expandida. O rodapé MUST exibir os controles de paginação com o total de departamentos. A página atual MUST ficar na query string (`page`, omitida na página 1), de modo que recarregar ou compartilhar a URL reproduza a mesma página; uma página além da última MUST levar à última. Sem categorias, a tela MUST mostrar o estado vazio "Nenhuma categoria cadastrada". No primeiro carregamento, a tela MUST exibir linhas de esqueleto estáticas, sem spinner nem animação.

#### Scenario: Árvore do seed
- **WHEN** um administrador acessa `/admin/catalog/categories` com o banco populado pelo seed
- **THEN** vê "12 departamentos no catálogo", os 12 departamentos em uma única página, começando por "Cartuchos & Toners", e a paginação com 1 página

#### Scenario: Segunda página de departamentos
- **WHEN** existem 25 departamentos e o administrador vai para a página 2
- **THEN** a URL passa a conter `page=2` e a árvore mostra os 5 últimos departamentos com suas descendentes

#### Scenario: Ação de subcategoria por nível
- **WHEN** a árvore exibe uma categoria de nível 2 e outra de nível 3
- **THEN** só a de nível 2 oferece "Nova subcategoria"

### Requirement: Preferência de exibição recolhida ou expandida
O cabeçalho da árvore SHALL oferecer um botão que alterna entre "Expandir tudo" e "Recolher tudo". A escolha MUST ser guardada no armazenamento local do navegador e reaplicada em visitas e recarregamentos seguintes; sem preferência guardada, ou com o armazenamento indisponível, a árvore MUST abrir recolhida, sem erro. A preferência MUST NOT ir para a URL.
- **Recolhida:** a tela MUST buscar só os departamentos da página. Cada categoria com filhas MUST exibir o controle "Expandir <nome>"; ao expandir, a tela MUST buscar apenas as filhas diretas daquela categoria, exibindo o texto "Carregando…" na linha abaixo enquanto chegam (sem spinner nem animação), e as filhas de nível 2 com filhas MUST poder ser expandidas da mesma forma. Recolher e expandir de novo um nó já carregado MUST NOT buscar de novo.
- **Expandida:** a tela MUST buscar, em uma chamada, os departamentos da página com toda a subárvore, e todos os nós abrem expandidos. O controle de cada nó MUST recolher e expandir localmente, sem nova busca.

Trocar a preferência MUST recarregar a página atual no novo modo.

#### Scenario: Primeira visita recolhida
- **WHEN** um administrador sem preferência guardada acessa `/admin/catalog/categories`
- **THEN** vê apenas os departamentos, o botão "Expandir tudo", e a tela buscou só a árvore recolhida

#### Scenario: Filhas sob demanda
- **WHEN** com a árvore recolhida o administrador expande "Escolar"
- **THEN** a tela busca as filhas diretas de "Escolar", mostra "Carregando…" até chegarem e então exibe os grupos recuados; recolher e expandir de novo não faz nova busca

#### Scenario: Preferência lembrada
- **WHEN** o administrador escolhe "Expandir tudo" e recarrega a página
- **THEN** a árvore abre com todos os departamentos, grupos e subgrupos visíveis e o botão mostra "Recolher tudo"

#### Scenario: Recolher um nó na árvore expandida
- **WHEN** com a árvore expandida o administrador recolhe "Escolar"
- **THEN** os grupos e subgrupos de "Escolar" deixam de ser exibidos sem nova busca, e os demais departamentos continuam como estavam

### Requirement: Busca na lista de categorias
A tela de categorias SHALL oferecer um campo de busca. Com texto, a árvore MUST dar lugar a uma lista plana paginada (20 por página) das categorias encontradas em qualquer nível, conforme as regras de busca da API, em que cada linha exibe o caminho completo, o slug, a ordem, o selo "Destaque" quando houver, o status e as ações editar, excluir e, nos níveis 1 e 2, "Nova subcategoria". Durante a busca, o controle recolhido/expandido MUST ficar oculto, o cabeçalho MUST mostrar "<n> categoria(s) encontrada(s)" e a paginação MUST contar as categorias encontradas. O texto MUST ser aplicado cerca de 300 ms depois da última tecla e ficar na query string (`search`); mudar a busca MUST voltar para a página 1. Limpar a busca MUST voltar para a árvore, na página 1, no modo da preferência guardada. Sem resultados, a tela MUST mostrar o estado vazio "Nenhuma categoria encontrada".

#### Scenario: Busca por subgrupo
- **WHEN** o administrador digita "borracha tecn" no campo de busca
- **THEN** a URL passa a conter `search=borracha%20tecn` sem `page` e a lista mostra "Escolar / Borrachas / Borrachas Técnicas" em uma linha, sem a árvore

#### Scenario: URL com busca
- **WHEN** o administrador abre `/admin/catalog/categories?search=livros&page=1`
- **THEN** vê a lista plana com as categorias "Livros" de "Escolar" e de "Suprimentos para Escritório", cada uma com seu caminho

### Requirement: Formulário de categoria
As rotas `/admin/catalog/categories/new` (criação) e `/admin/catalog/categories/[id]` (edição) SHALL exibir o formulário em página, não em modal, com o título "Nova categoria" ou "Editar categoria", o link "← Voltar para categorias" e as seções:
- **Posição na árvore:** categoria pai (seletor de categoria com busca na API) e ordem (numérico);
- **Identificação:** nome e slug;
- **Apresentação:** descrição (com contador até 500), "Categoria em destaque" e URL da imagem, com pré-visualização quando a URL é válida;
- **Status:** "Categoria ativa", apenas na edição.

Na criação, o slug MUST ser preenchido automaticamente a partir do nome até o administrador editá-lo manualmente; na edição, o slug existente não é recalculado. A criação MUST aceitar o parâmetro `?parentId=<id>` para pré-selecionar a pai; um id inexistente ou de uma categoria de nível 3 MUST deixar a pai como raiz. Nome fora de 2–100 caracteres, slug fora do formato, descrição acima de 500 caracteres, URL inválida e ordem que não seja inteiro maior ou igual a 0 MUST ser barrados no cliente, sem chamar a API. O envio MUST mandar o objeto completo, com `null` para pai, descrição e URL vazias e `isActive: true` na criação. Os botões MUST ser "Cancelar" e "Criar categoria"/"Salvar alterações" (com "salvando..." durante o envio). Enquanto a categoria em edição carrega, o formulário MUST exibir um esqueleto estático; se a categoria não for encontrada, a tela MUST exibir um toast de erro e voltar para a lista.

#### Scenario: Nova subcategoria a partir da árvore
- **WHEN** o administrador escolhe "Nova subcategoria" na linha de "Escolar"
- **THEN** abre `/admin/catalog/categories/new?parentId=<id de Escolar>` com "Escolar" já selecionada como pai

#### Scenario: Slug automático
- **WHEN** na criação o administrador digita o nome "Borrachas Técnicas" sem tocar no slug
- **THEN** o campo slug mostra "borrachas-tecnicas"; se ele editar o slug e depois mudar o nome, o slug editado é mantido

#### Scenario: Pai inválida na URL
- **WHEN** o administrador abre `/admin/catalog/categories/new?parentId=<id de uma categoria de nível 3>`
- **THEN** o formulário abre com "Sem categoria pai (raiz)" selecionada

#### Scenario: Validação no cliente
- **WHEN** o administrador submete o formulário com nome "A" ou URL de imagem "ftp://x"
- **THEN** as mensagens aparecem nos campos e nenhuma requisição é enviada

### Requirement: Seletor de categoria com busca na API
Todo seletor de categoria da área administrativa SHALL buscar as categorias na API sob demanda, sem carregar a lista completa: ao abrir, MUST mostrar as 20 primeiras categorias permitidas ordenadas pelo caminho; o texto digitado MUST ser aplicado cerca de 300 ms depois da última tecla, voltando para as primeiras 20 opções da busca; enquanto houver mais resultados, MUST oferecer "Carregar mais" no fim da lista; enquanto carrega, MUST mostrar "Carregando…"; sem resultados, "Nenhuma categoria encontrada.". As opções MUST ser rotuladas pelo caminho completo, e a opção selecionada MUST aparecer com o caminho mesmo quando não estiver entre as carregadas. O seletor é usado em:
- **Categoria pai, no formulário de categoria:** só categorias de nível 1 e 2; na edição, sem a própria categoria e sem nenhuma de suas descendentes, filtradas pela API; com a opção "Sem categoria pai (raiz)" no topo enquanto não houver texto de busca.
- **Filtro de categoria da listagem de produtos:** qualquer nível, com a opção "Todas as categorias" no topo enquanto não houver texto de busca; a categoria vinda da URL (`categoryId`) aparece selecionada pelo caminho.
- **Categoria do formulário de produto:** qualquer nível; na edição, a categoria atual aparece pelo `categoryPath` do produto.

#### Scenario: Busca de categoria pai
- **WHEN** no formulário de categoria o administrador abre o seletor de pai e digita "livros"
- **THEN** o seletor mostra "Escolar / Livros" e "Suprimentos para Escritório / Livros", sem nenhuma categoria de nível 3, e sem a opção raiz enquanto houver texto

#### Scenario: Pais oferecidos na edição
- **WHEN** o administrador edita "Escolar", que tem a filha "Borrachas", e digita "escolar" no seletor de pai
- **THEN** o seletor não oferece "Escolar" nem nenhuma categoria cujo caminho começa com "Escolar / "

#### Scenario: Carregar mais
- **WHEN** o administrador abre o seletor de categoria do formulário de produto sem digitar nada
- **THEN** vê 20 categorias rotuladas pelo caminho e "Carregar mais"; ao escolher "Carregar mais", as próximas 20 são acrescentadas à lista

#### Scenario: Filtro de produtos vindo da URL
- **WHEN** o administrador abre `/admin/catalog/products?categoryId=<id de Borrachas>`
- **THEN** o seletor de categoria da listagem exibe "Escolar / Borrachas" sem que a lista completa de categorias seja carregada

### Requirement: Erros da API no formulário
Quando a API rejeitar o salvamento, o formulário SHALL exibir a mensagem traduzida junto ao campo correspondente, focando o primeiro campo com erro:
- `CATEGORY_SLUG_ALREADY_EXISTS` no campo slug;
- `PARENT_CATEGORY_NOT_FOUND`, `CATEGORY_MAX_DEPTH_EXCEEDED` e `CATEGORY_CYCLE` no campo categoria pai;
- demais erros como notificação de erro, com o formulário mantendo os valores digitados.

As mensagens de `CATEGORY_NOT_FOUND`, `PARENT_CATEGORY_NOT_FOUND`, `CATEGORY_SLUG_ALREADY_EXISTS`, `CATEGORY_MAX_DEPTH_EXCEEDED`, `CATEGORY_CYCLE` e `CATEGORY_HAS_CHILDREN` MUST existir em português e inglês.

#### Scenario: Slug duplicado
- **WHEN** o administrador salva uma categoria com um slug já usado e a API responde `409` com `CATEGORY_SLUG_ALREADY_EXISTS`
- **THEN** o campo slug exibe "Já existe uma categoria com este slug." e os valores digitados são mantidos

#### Scenario: Movimentação que estoura a profundidade
- **WHEN** o administrador move uma categoria com filhas para uma pai de nível 2 e a API responde `400` com `CATEGORY_MAX_DEPTH_EXCEEDED`
- **THEN** o campo categoria pai exibe "A hierarquia de categorias permite no máximo 3 níveis."

### Requirement: Exclusão pela lista
A ação de excluir, na árvore ou na lista de busca, SHALL abrir um diálogo de confirmação com o título "Excluir categoria", o caminho da categoria e a exigência de digitar "excluir" para confirmar. Para uma categoria com filhas (`childrenCount` maior que zero), a confirmação MUST ficar desabilitada, com a mensagem "Exclua ou mova as subcategorias antes de excluir esta categoria.". Após excluir com sucesso, o sistema MUST exibir a notificação "Categoria excluída" e recarregar a página atual sem a categoria; se ela era o único item de uma página que não é a primeira, MUST ir para a página anterior. Uma recusa da API MUST ser exibida como notificação de erro, mantendo a categoria na lista.

#### Scenario: Exclusão bloqueada
- **WHEN** o administrador tenta excluir "Escolar", que tem filhas
- **THEN** o diálogo abre com a confirmação desabilitada e a mensagem sobre as subcategorias, e nenhuma requisição de exclusão é enviada

#### Scenario: Exclusão de folha
- **WHEN** o administrador confirma a exclusão de uma categoria sem filhas
- **THEN** aparece a notificação "Categoria excluída" e a categoria some da lista

### Requirement: Retorno à lista após salvar ou cancelar
"Nova categoria", "Nova subcategoria" e "Editar" SHALL levar ao formulário preservando a página e a busca da lista. Após criar ou editar com sucesso, o sistema MUST exibir a notificação "Categoria criada" ou "Categoria atualizada" e voltar para a lista com a mesma página e busca, com os dados atualizados. "Cancelar", "← Voltar para categorias" e a falha ao carregar a categoria MUST voltar para a mesma página e busca.

#### Scenario: Edição a partir de uma busca
- **WHEN** o administrador está em `/admin/catalog/categories?search=borrachas`, edita "Borrachas Técnicas", troca a pai para outro grupo e salva
- **THEN** aparece "Categoria atualizada" e a tela volta para `/admin/catalog/categories?search=borrachas`, exibindo o novo caminho da categoria

### Requirement: Exclusão de categoria com produtos bloqueada na árvore
Quando a API recusar a exclusão de uma categoria com `409` e o código `CATEGORY_HAS_PRODUCTS`, a tela de categorias MUST exibir um toast de erro com a mensagem "Categoria possui produtos cadastrados" e manter a categoria na árvore, sem exibir toast de sucesso.

#### Scenario: Exclusão bloqueada na tela
- **WHEN** o administrador confirma a exclusão de uma categoria folha com produtos em `/admin/catalog/categories`
- **THEN** vê o toast de erro "Categoria possui produtos cadastrados" e a categoria permanece na árvore
