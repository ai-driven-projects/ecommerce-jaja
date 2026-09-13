## MODIFIED Requirements

### Requirement: Navegação e menu do usuário
O rail lateral SHALL listar Visão geral (`/admin`), Catálogo, Pedidos, Clientes e Lojas, sem o item "Autenticação". O item Visão geral MUST ser marcado como ativo apenas em `/admin` exato. O menu do usuário no cabeçalho MUST exibir nome, email e avatar (quando houver) do usuário logado e a ação "Sair", sem item de perfil.

#### Scenario: Item ativo do dashboard
- **WHEN** o administrador está em `/admin/catalog`
- **THEN** o módulo aberto é Catálogo (com o seu sub-item "Visão geral" marcado) e o item Visão geral de `/admin` não está marcado

#### Scenario: Menu do usuário
- **WHEN** o administrador "Ana Souza" (ana@exemplo.com) abre o menu do usuário
- **THEN** vê "Ana Souza", "ana@exemplo.com" e a ação "Sair", sem "Perfil"

### Requirement: Submenu do módulo ativo agrupado em seções
Quando o módulo ativo da sidebar administrativa tiver mais de um sub-item no total, somando todas as suas seções, o sistema SHALL exibir os sub-itens logo abaixo do item principal ativo, agrupados por seção e na ordem definida para o módulo. Uma seção com rótulo MUST exibir o rótulo como cabeçalho não clicável acima dos seus sub-itens. Uma seção sem rótulo MUST exibir só os sub-itens. Uma seção sem sub-itens MUST ser omitida, inclusive o seu rótulo. Quando o módulo ativo tiver um ou nenhum sub-item, o sistema MUST NOT exibir sub-itens nem rótulos de seção. Os itens principais e os contadores MUST continuar como antes. A sidebar MUST destacar um único item por vez: quando um sub-item do módulo ativo corresponder à rota atual, só ele MUST ficar destacado e o item principal MUST ficar apenas expandido, sem destaque de ativo; quando nenhum sub-item corresponder, o item principal MUST ficar destacado.

#### Scenario: Seções com e sem rótulo
- **WHEN** o módulo ativo tem uma seção sem rótulo com "Visão geral" e uma seção rotulada "Relatórios" com "Vendas", e o administrador está em uma rota desse módulo
- **THEN** a sidebar mostra, sob o item principal ativo, "Visão geral", depois o cabeçalho "Relatórios" e, abaixo dele, "Vendas"

#### Scenario: Seção vazia omitida
- **WHEN** o módulo ativo tem duas seções com itens e uma terceira seção rotulada sem itens
- **THEN** a sidebar mostra só as duas seções com itens, e o rótulo da seção vazia não aparece

#### Scenario: Um único sub-item
- **WHEN** o módulo ativo tem apenas um sub-item no total
- **THEN** a sidebar mostra só os itens principais, sem sub-itens nem rótulos de seção, com o item do módulo destacado

#### Scenario: Um único item destacado
- **WHEN** o administrador está em uma rota que corresponde a um sub-item do módulo ativo
- **THEN** apenas o sub-item fica destacado e o item principal do módulo aparece expandido, sem o destaque de ativo

### Requirement: Seções do módulo Catálogo
O módulo "Catálogo de Produtos" (`/admin/catalog`) SHALL ter duas seções sem rótulo, nesta ordem: a primeira com o sub-item "Visão geral" (`/admin/catalog`), marcado como ativo só na rota `/admin/catalog` exata; e a segunda com os cadastros do catálogo, cada um ativo na sua rota e nas rotas abaixo dela. O rótulo "Cadastros" MUST NOT ser exibido. Os demais módulos MUST continuar sem sub-itens.

#### Scenario: Catálogo sem cadastros
- **WHEN** a seção de cadastros não tem sub-itens e o administrador acessa `/admin/catalog`
- **THEN** o item "Catálogo de Produtos" fica destacado, sem sub-itens e sem rótulo de seção

#### Scenario: Catálogo com um cadastro
- **WHEN** a seção de cadastros tem um sub-item com prefixo `/admin/catalog/<cadastro>` e o administrador acessa `/admin/catalog`
- **THEN** sob "Catálogo de Produtos" aparecem "Visão geral" destacado e o sub-item do cadastro, não destacado, sem o rótulo "Cadastros"; o item principal fica só expandido

#### Scenario: Visão geral do catálogo
- **WHEN** o administrador `usuario@formacao.dev` acessa `/admin/catalog`
- **THEN** sob "Catálogo de Produtos" aparecem "Visão geral" destacado e os cadastros, sem o rótulo "Cadastros", e o item "Catálogo de Produtos" fica expandido sem destaque

#### Scenario: Visão geral só na rota exata
- **WHEN** o administrador acessa uma rota sob o prefixo de um cadastro, como `/admin/catalog/brands/new`
- **THEN** apenas o sub-item do cadastro fica destacado; "Visão geral" e "Catálogo de Produtos" não ficam marcados

#### Scenario: Demais módulos inalterados
- **WHEN** o administrador acessa `/admin`, `/admin/orders`, `/admin/couriers`, `/admin/customers` ou `/admin/stores`
- **THEN** a sidebar mostra só os itens principais, com o item do módulo destacado, como antes desta entrega
