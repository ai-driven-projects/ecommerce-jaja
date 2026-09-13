## ADDED Requirements

### Requirement: Submenu do módulo ativo agrupado em seções
Quando o módulo ativo da sidebar administrativa tiver mais de um sub-item no total, somando todas as suas seções, o sistema SHALL exibir os sub-itens logo abaixo do item principal ativo, agrupados por seção e na ordem definida para o módulo. Uma seção com rótulo MUST exibir o rótulo como cabeçalho não clicável acima dos seus sub-itens. Uma seção sem rótulo MUST exibir só os sub-itens. Uma seção sem sub-itens MUST ser omitida, inclusive o seu rótulo. Quando o módulo ativo tiver um ou nenhum sub-item, o sistema MUST NOT exibir sub-itens nem rótulos de seção. Os itens principais, os contadores e a marcação de item ativo MUST continuar como antes.

#### Scenario: Seções com e sem rótulo
- **WHEN** o módulo ativo tem uma seção sem rótulo com "Visão geral" e uma seção "Cadastros" com "Marcas", e o administrador está em uma rota desse módulo
- **THEN** a sidebar mostra, sob o item principal ativo, "Visão geral", depois o cabeçalho "Cadastros" e, abaixo dele, "Marcas"

#### Scenario: Seção vazia omitida
- **WHEN** o módulo ativo tem duas seções com itens e uma terceira seção rotulada sem itens
- **THEN** a sidebar mostra só as duas seções com itens, e o rótulo da seção vazia não aparece

#### Scenario: Um único sub-item
- **WHEN** o módulo ativo tem apenas um sub-item no total
- **THEN** a sidebar mostra só os itens principais, sem sub-itens nem rótulos de seção

### Requirement: Seções do módulo Catálogo
O módulo "Produtos & estoque" (`/admin/catalog`) SHALL ter duas seções, nesta ordem: uma seção sem rótulo com o sub-item "Visão geral" (`/admin/catalog`), marcado como ativo só na rota `/admin/catalog` exata; e a seção "Cadastros", sem sub-itens nesta entrega, onde os cadastros do catálogo passam a ser listados. Enquanto "Visão geral" for o único sub-item, o menu do Catálogo MUST ficar igual ao anterior, sem sub-itens nem o rótulo "Cadastros". Os demais módulos MUST continuar sem sub-itens.

#### Scenario: Catálogo sem cadastros
- **WHEN** o administrador `usuario@formacao.dev` acessa `/admin/catalog`
- **THEN** o item "Produtos & estoque" fica ativo, sem sub-itens e sem o rótulo "Cadastros", como antes desta entrega

#### Scenario: Catálogo com um cadastro
- **WHEN** a seção "Cadastros" tem um sub-item com prefixo `/admin/catalog/<cadastro>` e o administrador acessa `/admin/catalog`
- **THEN** sob "Produtos & estoque" aparecem "Visão geral" ativo, o rótulo "Cadastros" e o sub-item do cadastro, não ativo

#### Scenario: Visão geral só na rota exata
- **WHEN** a seção "Cadastros" tem um sub-item com prefixo `/admin/catalog/<cadastro>` e o administrador acessa uma rota sob esse prefixo
- **THEN** o sub-item do cadastro fica ativo e "Visão geral" não fica marcado

#### Scenario: Demais módulos inalterados
- **WHEN** o administrador acessa `/admin`, `/admin/orders`, `/admin/couriers`, `/admin/customers` ou `/admin/stores`
- **THEN** a sidebar mostra só os itens principais, com o item do módulo marcado como ativo, como antes desta entrega
