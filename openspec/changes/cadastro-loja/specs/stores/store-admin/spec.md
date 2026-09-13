## Purpose

Define as telas de lojas da área administrativa do Jaja: a lista paginada com busca refletida na URL, o formulário em página com a localização da loja no Google Maps ou no mapa simulado, o item "Lojas" do menu e o uso uniforme do termo "loja" na área administrativa, sem lojas fictícias fora do cadastro.

## ADDED Requirements

### Requirement: Lista de lojas na área administrativa
O sistema SHALL servir em `/admin/stores` a lista paginada de lojas (20 por página), dentro do shell administrativo e com a mesma proteção das demais rotas administrativas. A tela MUST exibir:
- o cabeçalho "Lojas", com a quantidade total de lojas no subtítulo; durante uma busca, o subtítulo passa a "N lojas encontradas";
- um campo de busca por nome, slug ou endereço;
- o botão "Nova loja";
- a paginação ao final, com o total de "lojas".

Cada linha MUST exibir:
- o nome, com o slug abaixo;
- o endereço de referência, ou "—" quando não houver;
- o telefone no formato `(85) 3000-1001` (ou `(85) 99999-9999` para nove dígitos após o DDD), ou "—" quando não houver;
- o raio formatado ("800 m", "1 km", "2,5 km");
- o status "Ativa" ou "Inativa";
- as ações editar e excluir.

Excluir MUST pedir confirmação antes de chamar a API. Em sucesso, a tela MUST exibir o toaster "Loja excluída" e remover a loja da lista; excluir a única loja de uma página que não é a primeira MUST levar à página anterior. Uma falha MUST aparecer em um toaster de erro, mantendo a loja na lista. Sem lojas, a tela MUST exibir um estado vazio; durante uma busca sem resultados, um estado vazio próprio de busca.

#### Scenario: Lista após o seed
- **WHEN** o administrador `usuario@formacao.dev` acessa `/admin/stores` após o seed
- **THEN** vê "Lojas" com a contagem de 2, "Loja Aldeota" antes de "Loja Cocó", cada uma com o raio "2,5 km", o telefone formatado e o status "Ativa"

#### Scenario: Excluir pela lista
- **WHEN** o administrador escolhe excluir uma loja e confirma
- **THEN** vê o toaster "Loja excluída" e a loja some da lista; se cancelar, nada é excluído

#### Scenario: Busca sem resultados
- **WHEN** o administrador busca por um texto que não casa com nenhuma loja
- **THEN** a tela mostra o estado vazio de busca, e não o estado de lista vazia

### Requirement: Estado da lista de lojas na URL
A página e a busca da lista SHALL ser mantidas na query string de `/admin/stores` (`page`, `search`), de modo que recarregar ou compartilhar o endereço reproduza a mesma lista. A busca MUST ser aplicada pouco depois de o administrador parar de digitar e MUST voltar para a primeira página. Uma página além da última MUST levar à última página existente. Os links de criação e de edição MUST levar a query atual, para que salvar ou cancelar volte à mesma página e busca.

#### Scenario: Busca refletida na URL
- **WHEN** o administrador digita "aldeota" no campo de busca
- **THEN** a URL passa a conter `search=aldeota`, sem `page`, e a lista mostra apenas a "Loja Aldeota"

#### Scenario: Página além da última
- **WHEN** o administrador acessa `/admin/stores?page=5` com 2 lojas cadastradas
- **THEN** é levado para a página 1

#### Scenario: Voltar à mesma busca após editar
- **WHEN** o administrador está em `/admin/stores?search=coco`, abre a edição da "Loja Cocó" e salva
- **THEN** vê o toaster "Loja atualizada" e volta para `/admin/stores?search=coco`

### Requirement: Formulário de loja em página
O sistema SHALL servir o formulário de loja como página, e não como modal, em `/admin/stores/new` (criação) e `/admin/stores/<id>` (edição, carregando os dados da loja). A página MUST ter o cabeçalho "Nova loja" ou "Editar loja", o link "← Voltar para lojas" e um esqueleto enquanto os dados carregam. O formulário MUST ter as seções:
- **Identificação**: nome, slug e telefone;
- **Localização e atendimento**: endereço de referência, o mapa da loja, latitude, longitude e raio em metros, com o texto "Ponto da loja e raio de entrega em linha reta. Nesta versão o raio é informativo e não restringe pedidos.";
- **Publicação**: a opção "Ativa", exibida apenas na edição.

Na criação, o slug MUST ser preenchido a partir do nome enquanto o administrador não editar o slug manualmente; na edição, o slug não muda com o nome. Os campos MUST ser validados no cliente com as mesmas regras da API antes do envio. Os erros da API MUST aparecer no campo correspondente:
- nome já cadastrado, no nome;
- slug já cadastrado, no slug;
- telefone inválido, no telefone;
- latitude inválida, na latitude;
- longitude inválida, na longitude;
- raio inválido, no raio.

Os demais erros MUST aparecer em um toaster. Em sucesso, o sistema MUST exibir o toaster "Loja criada" ou "Loja atualizada" e voltar para a lista na mesma página e busca de origem, com a lista atualizada. Uma loja inexistente MUST exibir um toaster de erro e voltar para a lista.

#### Scenario: Slug automático
- **WHEN** o administrador em `/admin/stores/new` digita o nome "Loja Cocó Sul" sem tocar no slug
- **THEN** o campo slug mostra `loja-coco-sul`; se ele editar o slug para `coco-sul` e depois mudar o nome, o slug continua `coco-sul`

#### Scenario: Raio inválido no cliente
- **WHEN** o administrador informa o raio `250` e tenta salvar
- **THEN** o erro de raio inválido aparece no campo do raio e nenhuma chamada à API é feita

#### Scenario: Conflito de nome no formulário
- **WHEN** o administrador tenta criar uma loja com o nome "Loja Aldeota", já cadastrado
- **THEN** o erro de nome já cadastrado aparece no campo nome e ele continua no formulário

#### Scenario: Desativar pela edição
- **WHEN** o administrador abre `/admin/stores/<id>` da "Loja Cocó", desmarca "Ativa" e salva
- **THEN** vê "Loja atualizada", volta para a lista e a "Loja Cocó" aparece com o status "Inativa"

#### Scenario: Loja inexistente
- **WHEN** o administrador acessa `/admin/stores/<id>` com um id que não pertence a nenhuma loja
- **THEN** vê um toaster de erro e volta para a lista de lojas

### Requirement: Localização no Google Maps
Quando a chave pública do Google Maps estiver configurada e o mapa carregar, a seção de localização SHALL exibir um mapa interativo:
- na edição, o mapa MUST abrir centrado no ponto da loja, com zoom de rua; na criação, antes de haver ponto, MUST abrir centrado no ponto simulado da Avenida Paulista, sem marcador;
- clicar no mapa MUST definir o ponto, e arrastar o marcador MUST movê-lo;
- um círculo MUST representar o raio ao redor do ponto; arrastar a borda do círculo MUST alterar o raio, gravado em múltiplos de 50 m e limitado de 300 a 10.000 m;
- os campos latitude, longitude e raio MUST refletir as mudanças feitas no mapa, e editar esses campos MUST mover o marcador e o círculo;
- o botão "Localizar endereço no mapa" MUST ficar desabilitado enquanto o endereço de referência tiver menos de 3 caracteres. Ao ser acionado, MUST buscar as coordenadas do endereço, posicionar o ponto, centralizar o mapa e exibir o endereço encontrado. Quando a busca vier simulada, MUST exibir o aviso "Busca de endereço simulada: o backend está sem GOOGLE_MAPS_API_KEY". Endereço não encontrado ou busca indisponível MUST aparecer em um toaster com a mensagem traduzida, sem mudar o ponto.

#### Scenario: Clicar no mapa
- **WHEN** o administrador clica em um ponto do mapa no formulário de uma loja
- **THEN** o marcador e o círculo passam para esse ponto e os campos latitude e longitude mostram as coordenadas dele

#### Scenario: Redimensionar o círculo
- **WHEN** o administrador arrasta a borda do círculo até cerca de 1.230 m
- **THEN** o campo raio passa a `1250` e o círculo fica com esse raio

#### Scenario: Editar os campos numéricos
- **WHEN** o administrador digita novas latitude e longitude e o raio `2000`
- **THEN** o marcador vai para as coordenadas digitadas e o círculo passa a ter 2.000 m

#### Scenario: Localizar endereço
- **WHEN** o administrador preenche o endereço de referência e aciona "Localizar endereço no mapa" com a busca respondendo `source: "google"`
- **THEN** o ponto vai para as coordenadas encontradas, o mapa centraliza nele e o endereço formatado aparece como texto de apoio

#### Scenario: Busca de endereço simulada
- **WHEN** o administrador aciona "Localizar endereço no mapa" e a busca responde `source: "mock"`
- **THEN** o ponto vai para a Avenida Paulista e aparece o aviso de busca de endereço simulada

### Requirement: Mapa simulado sem chave do Google
Quando a chave pública do Google Maps não estiver configurada, ou quando o mapa não carregar (chave recusada ou sem conexão), a seção de localização SHALL exibir o mapa simulado no lugar do Google Maps, sem nenhuma requisição ao Google. Na falha de carregamento, a tela MUST informar que o Google Maps não pôde ser carregado. O mapa simulado MUST:
- ser uma ilustração própria de ruas com a "Av. Paulista", um marcador ao centro e o círculo do raio, e não uma captura de serviços de mapa reais;
- exibir o selo "Mapa simulado" e a legenda "Google Maps indisponível: configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. A localização usa um ponto fixo de exemplo (Avenida Paulista, 1578 – São Paulo/SP) com raio de 1 km.";
- ser selecionável por clique, Enter ou Espaço; selecionar a imagem MUST preencher sempre `latitude -23.561414`, `longitude -46.655881` e raio de 1.000 m;
- manter os campos latitude, longitude e raio somente leitura e não exibir o botão "Localizar endereço no mapa";
- na criação, já começar com o ponto e o raio simulados preenchidos;
- na edição, preservar o ponto e o raio salvos, exibidos como "Ponto salvo: <latitude>, <longitude> · raio <raio formatado>", até o administrador selecionar a imagem.

#### Scenario: Criação sem chave
- **WHEN** a chave pública não está configurada e o administrador cria a loja "Loja Paulista" sem tocar na localização
- **THEN** vê o selo "Mapa simulado" e a loja é salva com `latitude -23.561414`, `longitude -46.655881` e raio de 1.000 m

#### Scenario: Edição sem chave preserva o ponto
- **WHEN** a chave pública não está configurada e o administrador edita só o telefone da "Loja Aldeota" e salva
- **THEN** a loja continua com o ponto em Fortaleza e o raio de 2.500 m

#### Scenario: Selecionar a imagem na edição
- **WHEN** a chave pública não está configurada e o administrador, na edição da "Loja Aldeota", seleciona o mapa simulado e salva
- **THEN** a loja passa a ter `latitude -23.561414`, `longitude -46.655881` e raio de 1.000 m

#### Scenario: Chave recusada
- **WHEN** a chave pública está configurada, mas o Google a recusa ao carregar o mapa
- **THEN** a tela informa que o Google Maps não pôde ser carregado e exibe o mapa simulado

### Requirement: Item Lojas no menu administrativo
O menu administrativo SHALL exibir o item principal "Lojas", que leva a `/admin/stores`. O item MUST ficar destacado em `/admin/stores` e nas rotas abaixo dela (`/admin/stores/new` e `/admin/stores/<id>`). O módulo MUST NOT ter sub-itens nem uma tela de visão geral.

#### Scenario: Menu na lista
- **WHEN** o administrador acessa `/admin/stores`
- **THEN** o menu mostra o item "Lojas" destacado, sem sub-itens, e a tela exibida é a lista de lojas

#### Scenario: Menu no formulário
- **WHEN** o administrador está em `/admin/stores/new`
- **THEN** o item "Lojas" continua destacado, sem sub-itens

### Requirement: Nomenclatura de lojas na área administrativa
A área administrativa SHALL chamar de "lojas" os pontos de onde saem as entregas, sem usar o termo "hub". A tela de acesso administrativa MUST exibir "Acesso restrito à equipe das lojas.". A área administrativa MUST NOT exibir lojas fictícias fora do cadastro. Em particular:
- o rodapé do menu, abaixo do nome do usuário, MUST NOT mostrar um nome de loja fixo;
- o dashboard `/admin` MUST NOT ter o card de área de cobertura com lojas, bairros e raio de exemplo.

#### Scenario: Dashboard sem lojas fictícias
- **WHEN** o administrador `usuario@formacao.dev` acessa `/admin`
- **THEN** não há card de área de cobertura, nem os textos "hub" ou "Hub Aldeota" no dashboard e no menu

#### Scenario: Tela de acesso
- **WHEN** um visitante acessa `/admin/login`
- **THEN** vê "Acesso restrito à equipe das lojas."
