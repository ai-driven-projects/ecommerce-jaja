## Purpose

Define as telas de clientes da área administrativa do Jaja: a lista paginada com busca e filtro de status refletidos na URL e a edição do cliente em página. Clientes não são criados nem excluídos pela administração, porque nascem do próprio usuário no checkout.

## ADDED Requirements

### Requirement: Lista de clientes na área administrativa
O sistema SHALL servir em `/admin/customers` a lista de clientes, dentro do shell administrativo e com a mesma proteção das demais rotas administrativas, no lugar da tela provisória do módulo "Clientes". A tela MUST exibir:
- o cabeçalho "Clientes", com a quantidade total de clientes no subtítulo; durante uma busca, o subtítulo passa a "N clientes encontrados";
- um campo de busca com o texto de apoio "Buscar por nome, email, CPF ou telefone";
- um seletor de status com as opções todos, ativos e inativos;
- a paginação ao final, com o total de "clientes".

Cada linha MUST exibir o nome e o email do usuário, o CPF no formato `000.000.000-00`, o telefone no formato `(85) 99999-9999` (ou `(85) 9999-9999` para oito dígitos após o DDD), o bairro com cidade/UF, o status "Ativo" ou "Inativo" e a ação de editar. A tela MUST NOT oferecer ação de criar nem de excluir clientes. Sem clientes, MUST exibir o estado vazio "Nenhum cliente ainda" com "Os clientes aparecem aqui quando preenchem os dados de entrega no checkout."; durante uma busca sem resultados, MUST exibir um estado vazio próprio de busca.

#### Scenario: Lista após o seed
- **WHEN** o administrador `usuario@formacao.dev` acessa `/admin/customers` após o seed
- **THEN** vê "Clientes" com a contagem de 40, 20 clientes na primeira página com CPF e telefone formatados, o status "Ativo" e a paginação com 2 páginas

#### Scenario: Sem criação nem exclusão
- **WHEN** o administrador está em `/admin/customers`
- **THEN** não há botão de novo cliente nem ação de excluir em nenhuma linha

#### Scenario: Busca sem resultados
- **WHEN** o administrador busca por um texto que não casa com nenhum cliente
- **THEN** a tela mostra o estado vazio de busca, e não o "Nenhum cliente ainda"

### Requirement: Estado da lista de clientes na URL
A página, a busca e o status da lista SHALL ser mantidos na query string de `/admin/customers`, de modo que recarregar ou compartilhar o endereço reproduza a mesma lista. A busca MUST ser aplicada pouco depois de o administrador parar de digitar e MUST voltar para a primeira página. Uma página além da última MUST levar à última página existente. O link de edição MUST levar a query atual, para o retorno do formulário voltar à mesma lista.

#### Scenario: Busca refletida na URL
- **WHEN** o administrador, na página 2, digita "ana" no campo de busca
- **THEN** a URL passa a conter `search=ana`, sem a página 2, e a lista mostra os resultados da busca

#### Scenario: Reload preserva a lista
- **WHEN** o administrador recarrega `/admin/customers?page=2&isActive=true`
- **THEN** vê a página 2 da lista de clientes ativos, com o seletor de status em "ativos"

#### Scenario: Página além da última
- **WHEN** o administrador acessa `/admin/customers?page=9` com 40 clientes
- **THEN** é levado para a página 2

### Requirement: Edição de cliente em página
O sistema SHALL servir a edição de cliente como página (não modal) em `/admin/customers/<id>`, com o cabeçalho "Editar cliente", o link "← Voltar para clientes" e um esqueleto enquanto os dados carregam. O formulário MUST ter as seções:
- **Conta**: nome e email do usuário, somente leitura, com o texto "Nome e email são da conta do usuário e não mudam aqui";
- **Documento e contato**: CPF e telefone, com máscara;
- **Endereço de entrega**: CEP com máscara `00000-000`, logradouro, número, complemento, bairro, cidade e UF, esta escolhida em uma lista das 27 unidades federativas;
- **Situação**: a opção "Ativo".

Os campos MUST ser validados no cliente com as mesmas regras da API antes do envio. Os erros da API MUST aparecer no campo correspondente:
- CPF já cadastrado ou inválido, no CPF;
- telefone inválido, no telefone;
- CEP inválido, no CEP;
- UF inválida, na UF.

Os demais erros MUST aparecer em um toaster. Em sucesso, o sistema MUST exibir o toaster "Cliente atualizado" e voltar para a lista na mesma página, busca e status de origem, com a lista atualizada. Um cliente inexistente MUST exibir um toaster de erro e voltar para a lista. Não existe página de criação de cliente.

#### Scenario: Desativar pela edição
- **WHEN** o administrador abre a edição de um cliente a partir de `/admin/customers?page=2`, desmarca "Ativo" e salva
- **THEN** vê "Cliente atualizado", volta para `/admin/customers?page=2` e o cliente aparece com o status "Inativo"

#### Scenario: CPF de outro cliente
- **WHEN** o administrador troca o CPF de um cliente pelo CPF de outro cliente e salva
- **THEN** a mensagem "Este CPF já está cadastrado." aparece no campo CPF e ele continua no formulário

#### Scenario: Dados da conta somente leitura
- **WHEN** o administrador abre a edição de um cliente
- **THEN** vê o nome e o email do usuário vinculado sem poder editá-los

#### Scenario: Cliente inexistente
- **WHEN** o administrador acessa `/admin/customers/new` ou o endereço de um cliente que não existe
- **THEN** vê um toaster de erro e volta para a lista de clientes
