## MODIFIED Requirements

### Requirement: Guarda de sessão
O app SHALL ter uma lista de rotas que exigem sessão; sem sessão, abrir uma delas MUST levar a "Entrar" com o destino em `from` (caminho e query da rota pedida). Exigem sessão os dados de entrega, o checkout e a página do pedido, e o que fica abaixo de cada uma delas. Com sessão, abrir "Entrar" ou "Criar conta" MUST levar direto ao destino de `from`, o que também conclui o acesso depois de entrar ou criar conta. Só destinos relativos iniciados por `/` (não por `//`) e fora das telas de abertura e de acesso MUST ser aceitos; qualquer outro valor, ou a falta dele, MUST levar à aba Início. Quando a sessão termina numa rota que exige sessão, o app MUST levar a "Entrar" com essa rota como destino.

#### Scenario: Já autenticado
- **WHEN** com sessão ativa o app navega para `/login?from=/search?category=escolar`
- **THEN** a aba Buscar é exibida com `category=escolar`, sem a tela "Entrar"

#### Scenario: Destino externo ignorado
- **WHEN** a pessoa abre `/login?from=https://exemplo.com` e entra com sucesso
- **THEN** a aba Início é exibida

#### Scenario: Rota protegida sem sessão
- **WHEN** sem sessão, o app abre o checkout
- **THEN** a tela "Entrar" aparece com `from` apontando para o checkout
