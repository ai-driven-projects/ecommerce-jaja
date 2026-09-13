## Purpose

Define o cadastro de marcas do catálogo do Jaja pela área administrativa: dados e validações da marca, unicidade de nome e slug, exclusão lógica, o contrato HTTP `/brands` restrito a administradores, a carga inicial das marcas raspadas da Kalunga e as telas de lista e formulário acessadas pelo menu do Catálogo.

## ADDED Requirements

### Requirement: Dados da marca
Uma marca SHALL ter identificador (uuid), `name`, `slug`, `description`, `logoUrl`, `isActive`, `createdAt` e `updatedAt`. `name` MUST ter de 2 a 100 caracteres após remover espaços nas pontas. `slug` MUST seguir o padrão `^[a-z0-9]+(?:-[a-z0-9]+)*$`. `description` é opcional e, quando informada, MUST ter no máximo 500 caracteres. `logoUrl` é opcional e, quando informada, MUST ser uma URL http ou https. `isActive` MUST valer `true` quando não informado na criação. Dados inválidos MUST ser rejeitados com `400` e os códigos de erro de validação, sem gravar nada.

#### Scenario: Marca válida com valores padrão
- **WHEN** um administrador cria a marca `{ name: "Acme" }`
- **THEN** a marca é gravada com `slug = "acme"`, `description = null`, `logoUrl = null` e `isActive = true`

#### Scenario: Nome vazio
- **WHEN** um administrador tenta criar a marca `{ name: "" }`
- **THEN** o sistema responde `400` com o código de nome inválido e nenhuma marca é criada

#### Scenario: Slug inválido
- **WHEN** um administrador tenta criar a marca `{ name: "Acme", slug: "Acme Marca" }`
- **THEN** o sistema responde `400` com o código de slug inválido e nenhuma marca é criada

#### Scenario: URL de logo inválida
- **WHEN** um administrador tenta criar a marca `{ name: "Acme", logoUrl: "ftp://exemplo.com/logo.png" }` ou `logoUrl: "logo"`
- **THEN** o sistema responde `400` com o código de URL inválida e nenhuma marca é criada

#### Scenario: Descrição longa demais
- **WHEN** um administrador tenta criar uma marca com `description` de 501 caracteres
- **THEN** o sistema responde `400` com o código de texto longo demais

### Requirement: Slug derivado do nome
Quando o `slug` não for informado na criação, o sistema SHALL derivá-lo do `name`: letras minúsculas, sem acentos, cada sequência de caracteres que não sejam letras ou dígitos substituída por um hífen, sem hífens nas pontas. Na alteração, um `slug` não informado MUST manter o slug atual da marca.

#### Scenario: Nome com acento e símbolo
- **WHEN** um administrador cria a marca `{ name: "Café & Cia" }` sem `slug`
- **THEN** a marca é gravada com `slug = "cafe-cia"`

#### Scenario: Alteração sem slug
- **WHEN** um administrador altera o nome da marca de slug `acme` para "Acme Brasil" sem enviar `slug`
- **THEN** a marca passa a se chamar "Acme Brasil" e continua com `slug = "acme"`

### Requirement: Nome e slug únicos
O `name` SHALL ser único no catálogo sem distinção de maiúsculas e minúsculas, e o `slug` SHALL ser único no catálogo. Criar ou alterar uma marca com um nome já usado por outra marca MUST responder `409` com `BRAND_NAME_ALREADY_EXISTS`; com um slug já usado por outra marca MUST responder `409` com `BRAND_SLUG_ALREADY_EXISTS`. Na alteração, a própria marca MUST ser ignorada na verificação. Nome e slug de uma marca excluída MUST continuar reservados e produzir os mesmos `409`.

#### Scenario: Nome duplicado com outra caixa
- **WHEN** existe a marca "Acme" e um administrador cria a marca `{ name: "ACME", slug: "acme-2" }`
- **THEN** o sistema responde `409` com `BRAND_NAME_ALREADY_EXISTS` e nenhuma marca é criada

#### Scenario: Slug duplicado
- **WHEN** existe a marca de slug `acme` e um administrador cria a marca `{ name: "Acme Brasil", slug: "acme" }`
- **THEN** o sistema responde `409` com `BRAND_SLUG_ALREADY_EXISTS`

#### Scenario: Alteração mantendo o próprio nome
- **WHEN** um administrador altera apenas a `description` da marca "Acme", reenviando `name: "Acme"` e `slug: "acme"`
- **THEN** o sistema responde `200` com a descrição alterada, sem conflito

#### Scenario: Nome de marca excluída
- **WHEN** a marca "Acme" (slug `acme`) foi excluída e um administrador cria a marca `{ name: "Acme" }`
- **THEN** o sistema responde `409` com o código de conflito correspondente e nenhuma marca é criada

### Requirement: API de marcas restrita a administradores
Todos os endpoints sob `/brands` MUST exigir um JWT válido de um usuário com `admin = true`. Sem token, com token expirado ou adulterado o sistema MUST responder `401`; com token válido de usuário não administrador MUST responder `403`. Nenhum desses casos MUST ler ou alterar marcas.

#### Scenario: Sem token
- **WHEN** um cliente chama `GET /brands` sem o cabeçalho `Authorization`
- **THEN** o sistema responde `401`

#### Scenario: Usuário não administrador
- **WHEN** um usuário do seed com `admin = false` chama `POST /brands` com o seu token
- **THEN** o sistema responde `403` e nenhuma marca é criada

### Requirement: Criar marca
O sistema SHALL expor `POST /brands` recebendo `name` e, opcionalmente, `slug`, `description`, `logoUrl` e `isActive`. Em sucesso MUST responder `201` com a marca criada (`id`, `name`, `slug`, `description`, `logoUrl`, `isActive`, `createdAt`, `updatedAt`), com um `id` uuid gerado pelo sistema.

#### Scenario: Criação válida
- **WHEN** um administrador envia `POST /brands` com `{ name: "Acme", description: "Materiais de escritório", logoUrl: "https://exemplo.com/acme.png" }`
- **THEN** o sistema responde `201` com a marca de `slug = "acme"`, `isActive = true` e um `id` uuid

### Requirement: Listar marcas
O sistema SHALL expor `GET /brands` que devolve `200` com a lista de marcas não excluídas, ordenada por nome sem distinção de maiúsculas e minúsculas, sem paginação. O parâmetro `search`, quando informado, MUST filtrar as marcas cujo nome ou slug contenha o texto, sem distinção de maiúsculas e minúsculas. O parâmetro `isActive`, quando `true` ou `false`, MUST filtrar pelo status.

#### Scenario: Busca por parte do nome
- **WHEN** após o seed um administrador chama `GET /brands?search=spir`
- **THEN** o sistema responde `200` com uma lista que contém a marca de slug `spiral` e só marcas cujo nome ou slug contém "spir"

#### Scenario: Ordenação sem distinção de caixa
- **WHEN** após o seed um administrador chama `GET /brands`
- **THEN** "Abyara" aparece antes de "ALFASHOW" e "ARTHI", independentemente do uso de maiúsculas no nome

#### Scenario: Filtro por status
- **WHEN** existe uma marca inativa e um administrador chama `GET /brands?isActive=false`
- **THEN** a lista contém apenas marcas com `isActive = false`

#### Scenario: Marca excluída não aparece
- **WHEN** um administrador exclui a marca "Acme" e chama `GET /brands?search=acme`
- **THEN** "Acme" não aparece na lista

### Requirement: Buscar marca por identificador
O sistema SHALL expor `GET /brands/:id` que responde `200` com a marca quando ela existir e não estiver excluída; caso contrário MUST responder `404`.

#### Scenario: Marca existente
- **WHEN** um administrador chama `GET /brands/<id>` com o id de uma marca ativa
- **THEN** o sistema responde `200` com os dados da marca

#### Scenario: Marca inexistente
- **WHEN** um administrador chama `GET /brands/<id>` com um uuid que não pertence a nenhuma marca
- **THEN** o sistema responde `404`

### Requirement: Alterar marca
O sistema SHALL expor `PUT /brands/:id` recebendo os mesmos campos da criação. Quando a marca existir, MUST aplicar as alterações, aplicar as mesmas validações e regras de unicidade e responder `200` com a marca alterada, com `updatedAt` atualizado. Quando o `id` informado nunca pertenceu a uma marca, MUST criar a marca com esse `id`. Quando o `id` pertencer a uma marca excluída, MUST responder `404` com `BRAND_NOT_FOUND`.

#### Scenario: Alteração válida
- **WHEN** um administrador envia `PUT /brands/<id>` da marca "Acme" com `{ name: "Acme", slug: "acme", isActive: false }`
- **THEN** o sistema responde `200` com `isActive = false` e a marca deixa de aparecer em `GET /brands?isActive=true`

#### Scenario: Alteração de marca excluída
- **WHEN** um administrador envia `PUT /brands/<id>` com o id de uma marca excluída
- **THEN** o sistema responde `404` com `BRAND_NOT_FOUND` e a marca continua excluída

### Requirement: Exclusão lógica de marca
O sistema SHALL expor `DELETE /brands/:id` que marca a marca como excluída, preservando o registro, e responde `204` sem corpo. Depois disso a marca MUST NOT ser retornada por nenhuma busca ou listagem. Excluir uma marca inexistente ou já excluída MUST responder `404` com `BRAND_NOT_FOUND`.

#### Scenario: Exclusão seguida de busca
- **WHEN** um administrador chama `DELETE /brands/<id>` e em seguida `GET /brands/<id>`
- **THEN** a exclusão responde `204`, a busca responde `404` e o registro continua no banco com a data de exclusão preenchida

#### Scenario: Exclusão de marca inexistente
- **WHEN** um administrador chama `DELETE /brands/<id>` com um uuid que não pertence a nenhuma marca
- **THEN** o sistema responde `404` com `BRAND_NOT_FOUND`

### Requirement: Carga inicial das marcas da Kalunga
O seed de desenvolvimento SHALL cadastrar as marcas do arquivo raspado da Kalunga (`apps/cli/data/kalunga/brands.json`), sem copiá-lo nem alterá-lo. Cada slug MUST ser normalizado pela mesma regra de derivação de slug; entradas com o mesmo slug normalizado MUST virar uma única marca com o nome da primeira ocorrência. As marcas carregadas MUST ter `description = null`, `logoUrl = null` e `isActive = true`. Executar o seed novamente MUST NOT duplicar marcas nem sobrescrever marcas já existentes. Se o arquivo não existir, o seed MUST falhar com uma mensagem que indique o caminho esperado.

#### Scenario: Seed em banco vazio
- **WHEN** o seed é executado em um banco sem marcas
- **THEN** a tabela de marcas passa a ter 210 registros, com uma única marca para `spiral`, `hp` e `trident` e a marca "Make+" com `slug = "make"`

#### Scenario: Seed repetido
- **WHEN** o seed é executado duas vezes seguidas
- **THEN** a tabela de marcas continua com 210 registros

### Requirement: Lista de marcas na área administrativa
O sistema SHALL servir em `/admin/catalog/brands`, dentro do shell administrativo e com a mesma proteção das demais rotas administrativas, a lista de marcas com cabeçalho de seção, campo de busca e botão "Nova marca". Cada linha MUST exibir a miniatura do logotipo (ou um placeholder na cor de superfície quando não houver logo), nome, slug, o status "Ativa" ou "Inativa" e as ações editar e excluir. Excluir MUST pedir confirmação antes de chamar a API. Sem marcas para exibir, a tela MUST mostrar um estado vazio.

#### Scenario: Lista após o seed
- **WHEN** o administrador `usuario@formacao.dev` acessa `/admin/catalog/brands` após o seed
- **THEN** vê as 210 marcas ordenadas por nome, cada uma com o status "Ativa"

#### Scenario: Busca na lista
- **WHEN** o administrador digita "hp" no campo de busca
- **THEN** a lista passa a exibir apenas as marcas cujo nome ou slug contém "hp"

#### Scenario: Excluir pela lista
- **WHEN** o administrador escolhe excluir uma marca e confirma
- **THEN** vê um toaster de sucesso e a marca some da lista; se cancelar, nada é excluído

### Requirement: Formulário de marca em página
O sistema SHALL servir o formulário de marca como página (não modal) em `/admin/catalog/brands/new` (criação) e `/admin/catalog/brands/<id>` (edição, carregando os dados da marca). O formulário MUST ter os campos nome, slug, descrição e URL do logotipo; o campo de status ativo MUST aparecer apenas na edição. Na criação, o slug MUST ser preenchido automaticamente a partir do nome enquanto o usuário não editar o slug manualmente. Uma pré-visualização do logotipo MUST aparecer quando a URL for válida. Nome, slug, descrição e URL MUST ser validados no cliente com as mesmas regras da API antes do envio. Um conflito de nome ou slug retornado pela API MUST aparecer como erro no campo correspondente. Em sucesso na criação ou na edição, o sistema MUST exibir um toaster de sucesso e voltar para a lista atualizada.

#### Scenario: Slug automático
- **WHEN** o administrador em `/admin/catalog/brands/new` digita o nome "Café & Cia" sem tocar no slug
- **THEN** o campo slug mostra `cafe-cia`; se ele editar o slug para `cafe` e depois mudar o nome, o slug continua `cafe`

#### Scenario: Conflito de nome no formulário
- **WHEN** o administrador tenta criar uma marca com o nome de uma marca existente
- **THEN** o erro de nome já cadastrado aparece no campo nome e ele continua no formulário

#### Scenario: Edição com sucesso
- **WHEN** o administrador abre `/admin/catalog/brands/<id>`, desmarca "ativa" e salva
- **THEN** vê o toaster de sucesso, volta para `/admin/catalog/brands` e a marca aparece com o status "Inativa"

### Requirement: Item Marcas no menu do Catálogo
O menu do módulo Catálogo SHALL exibir, sob "Produtos & estoque", o sub-item "Visão geral", o rótulo de seção "Cadastros" e, dentro dele, o item "Marcas" que leva a `/admin/catalog/brands`. O item "Marcas" MUST ficar ativo em `/admin/catalog/brands` e em qualquer sub-rota dela.

#### Scenario: Menu no formulário
- **WHEN** o administrador está em `/admin/catalog/brands/new`
- **THEN** o módulo ativo é "Produtos & estoque", o menu mostra "Visão geral", "Cadastros" e "Marcas", e "Marcas" está marcado como ativo
