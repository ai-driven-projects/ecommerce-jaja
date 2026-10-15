## ADDED Requirements

### Requirement: Abertura com a sessão desconhecida
Enquanto a sessão ainda não foi lida, o app SHALL mostrar uma tela de abertura com a marca e um indicador de carregamento, sem a barra de abas, guardando o endereço pedido. Assim que a sessão for conhecida, o app MUST seguir para o endereço guardado (ou para a aba Início) aplicando a guarda de sessão.

#### Scenario: Abertura com sessão guardada
- **WHEN** o app abre e a conferência da sessão ainda não respondeu
- **THEN** a tela de abertura aparece sem a barra de abas e, quando a sessão é confirmada, a aba Início é exibida

### Requirement: Guarda de sessão
O app SHALL ter uma lista de rotas que exigem sessão; sem sessão, abrir uma delas MUST levar a "Entrar" com o destino em `from` (caminho e query da rota pedida). Nesta etapa nenhuma rota exige sessão: as etapas de dados de entrega, checkout e pedido acrescentam as suas. Com sessão, abrir "Entrar" ou "Criar conta" MUST levar direto ao destino de `from`, o que também conclui o acesso depois de entrar ou criar conta. Só destinos relativos iniciados por `/` (não por `//`) e fora das telas de abertura e de acesso MUST ser aceitos; qualquer outro valor, ou a falta dele, MUST levar à aba Início. Quando a sessão termina numa rota que exige sessão, o app MUST levar a "Entrar" com essa rota como destino.

#### Scenario: Já autenticado
- **WHEN** com sessão ativa o app navega para `/login?from=/search?category=escolar`
- **THEN** a aba Buscar é exibida com `category=escolar`, sem a tela "Entrar"

#### Scenario: Destino externo ignorado
- **WHEN** a pessoa abre `/login?from=https://exemplo.com` e entra com sucesso
- **THEN** a aba Início é exibida

#### Scenario: Rota protegida sem sessão
- **WHEN** sem sessão, o app abre uma rota da lista que exige sessão, `/x?y=1`
- **THEN** a tela "Entrar" aparece com `from=/x?y=1`
