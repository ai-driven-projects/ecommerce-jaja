## Purpose

Define a página "Minha conta" da loja, onde o usuário logado vê os seus dados de acesso e mantém os dados de cliente (CPF, telefone e endereço de entrega). O endereço pode ser digitado ou marcado no mapa, e o ponto marcado fica gravado para as regras de cobertura por loja.

## ADDED Requirements

### Requirement: Página Minha conta na loja
O sistema SHALL servir `/minha-conta` como rota pública dentro do shell da loja, com o cabeçalho completo da vitrine (seletor de lojas, busca, conta e sacola), o título "Minha conta" e o conteúdo no mesmo container de largura do checkout. A página MUST preservar a query da vitrine (loja, categoria e demais parâmetros) nos links do cabeçalho. A rota MUST NOT redirecionar visitantes sem sessão para outra página.

#### Scenario: Aberta pelo menu da conta
- **WHEN** um usuário autenticado em `/?loja=loja-paulista` escolhe "Minha conta" no menu da conta
- **THEN** a página `/minha-conta?loja=loja-paulista` exibe o título "Minha conta" e o cabeçalho da loja com "Loja Paulista"

#### Scenario: Sem rolagem horizontal no celular
- **WHEN** um usuário autenticado abre `/minha-conta` com a tela de 375px de largura
- **THEN** a página não tem rolagem horizontal, e os campos dos dados pessoais e do endereço ficam em uma coluna

### Requirement: Minha conta sem sessão
Sem sessão, `/minha-conta` SHALL exibir o título "Entre para ver sua conta" e o formulário com as abas "Entrar" e "Criar conta", com as mesmas validações e mensagens de `/entrar`. Ao entrar ou criar conta, o sistema MUST exibir a confirmação com o primeiro nome e manter a URL em `/minha-conta` com a mesma query, trocando o conteúdo para o estado autenticado sem navegar. Ao escolher "Sair" no menu da conta estando em `/minha-conta`, a página MUST continuar em `/minha-conta` e voltar a exibir o formulário de acesso.

#### Scenario: Visitante sem sessão
- **WHEN** um visitante sem sessão acessa `/minha-conta?loja=loja-rio-branco`
- **THEN** permanece em `/minha-conta?loja=loja-rio-branco` e vê "Entre para ver sua conta" com as abas "Entrar" e "Criar conta"

#### Scenario: Entrar na própria página
- **WHEN** o visitante entra com credenciais válidas em `/minha-conta?loja=loja-rio-branco`
- **THEN** a confirmação com o primeiro nome é exibida, a URL continua `/minha-conta?loja=loja-rio-branco` e a página passa a exibir os dados da conta

#### Scenario: Sair em Minha conta
- **WHEN** um usuário autenticado em `/minha-conta` escolhe "Sair" no menu da conta
- **THEN** "Até já já." é exibido, a URL continua `/minha-conta` e a página volta a exibir "Entre para ver sua conta"

### Requirement: Estados do cadastro em Minha conta
Com sessão, `/minha-conta` SHALL carregar o cadastro de cliente do usuário:
- enquanto carrega, MUST exibir cartões estáticos no lugar do formulário, sem animação de brilho;
- sem cadastro de cliente, MUST exibir o texto de apoio "Preencha uma vez e seus pedidos saem mais rápido." e o formulário vazio, com a cidade e a UF da loja escolhida na vitrine já preenchidas quando conhecidas, e o bairro vazio;
- com cadastro, MUST exibir o formulário com os dados atuais, inclusive o ponto do endereço quando houver.

Os dados salvos em "Minha conta" MUST ser os mesmos usados pelo passo de entrega do checkout, sem precisar recarregar a página.

#### Scenario: Usuário sem cadastro de cliente
- **WHEN** um usuário comum do seed sem cliente abre `/minha-conta?loja=loja-paulista`
- **THEN** vê "Preencha uma vez e seus pedidos saem mais rápido.", CPF, telefone, CEP, logradouro, número e bairro vazios, cidade "São Paulo" e UF "SP"

#### Scenario: Usuário com cadastro de cliente
- **WHEN** um usuário do seed com cliente em Fortaleza abre `/minha-conta`
- **THEN** vê o formulário preenchido com o CPF, o telefone e o endereço de Fortaleza do cadastro, sem ponto marcado

### Requirement: Dados pessoais
O cartão "Dados pessoais" SHALL exibir o nome e o email do usuário da sessão somente leitura, com o texto de apoio "Nome e email são da sua conta de acesso.", e os campos editáveis CPF e telefone, com máscara, lado a lado em telas largas. A página MUST NOT permitir alterar nome, email ou senha. CPF e telefone MUST ter as mesmas validações e mensagens do passo de entrega do checkout.

#### Scenario: Nome e email não editáveis
- **WHEN** a cliente "Ana Souza" (ana@exemplo.com) abre `/minha-conta`
- **THEN** vê "Ana Souza" e "ana@exemplo.com" sem campo editável para eles, e os campos CPF e telefone editáveis

#### Scenario: CPF inválido no formulário
- **WHEN** o usuário informa um CPF com dígito verificador inválido e tenta salvar
- **THEN** o formulário exibe o erro no campo CPF e nada é gravado

### Requirement: Salvar e descartar alterações
O formulário SHALL ter no rodapé o botão "Salvar dados", desabilitado enquanto não houver alterações e com o texto "Salvando…" durante o envio, e o botão "Descartar alterações", exibido só quando houver alterações, que volta aos valores carregados. Salvar MUST gravar CPF, telefone, os campos do endereço e o ponto atual do formulário no cadastro do próprio usuário (criando o cadastro quando não existir), exibir a confirmação "Dados salvos" e deixar o formulário sem alterações pendentes com os valores salvos. Erros de validação da API MUST aparecer nos campos correspondentes; `CUSTOMER_LOCATION_INVALID` MUST aparecer como erro geral acima do mapa.

#### Scenario: Salvar e recarregar
- **WHEN** um usuário marca um ponto, preenche os dados válidos, clica em "Salvar dados" e recarrega a página
- **THEN** "Dados salvos" é exibido, "Salvar dados" fica desabilitado, e depois de recarregar os campos e o marcador do ponto continuam como foram salvos

#### Scenario: Descartar alterações
- **WHEN** um usuário com cadastro muda o telefone e clica em "Descartar alterações"
- **THEN** o telefone volta ao valor carregado, "Descartar alterações" some e "Salvar dados" fica desabilitado

### Requirement: Endereço de entrega pelos campos e pelo mapa
O cartão "Endereço de entrega" SHALL exibir o mapa do ponto acima dos campos do endereço (CEP, logradouro, número, complemento, bairro, cidade e UF, com as mesmas validações do checkout), com o texto de apoio "Clique no mapa ou arraste o marcador até a porta de entrada. Sugerimos o endereço do ponto, e você decide se usa.". O mapa MUST abrir:
- com cadastro que tem ponto: centrado no ponto do cliente, com zoom de rua;
- sem ponto: enquadrando a loja selecionada na vitrine com todo o seu círculo de atendimento, para a área de entrega aparecer já na abertura;
- sem loja selecionada ou sem as coordenadas dela: centrado no ponto de exemplo da Avenida Paulista, 1578, em São Paulo.

O mapa MUST exibir **todas** as lojas ativas, cada uma com um marcador fixo (nome e raio de atendimento como título) e o círculo da sua área de atendimento, com o raio em metros da loja. O marcador e o círculo da loja selecionada na vitrine MUST ter destaque visual em relação aos das outras lojas, e todos MUST ter visual diferente do marcador do cliente. Os marcadores e os círculos das lojas MUST NOT ser arrastáveis nem editáveis, e clicar em um deles MUST marcar o ponto do cliente ali, como um clique no mapa. O marcador do cliente MUST ser arrastável e aparecer só quando houver ponto.

Abaixo do mapa, a página SHALL listar as lojas ativas com o nome, o endereço de referência e o raio de atendimento, com a loja selecionada indicada, para o usuário saber quais lojas existem mesmo quando elas estão fora da área visível ou o mapa está simulado.

Como a câmera inicial enquadra só a região da loja selecionada (ou do ponto do cliente), a página SHALL oferecer como chegar às demais lojas, sem mudar o ponto do cliente:
- cada loja da lista MUST ter a ação "Ver no mapa", que enquadra aquela loja com todo o seu círculo de atendimento;
- a lista MUST ter a ação "Ver todas as lojas", que enquadra todas as lojas ativas ao mesmo tempo, mais o ponto do cliente quando houver.

As duas ações MUST NOT gravar, mover nem apagar o ponto do cliente, e MUST NOT pedir sugestão de endereço. Com o mapa simulado, elas MUST NOT ser exibidas, porque não há câmera para mover.

O raio exibido é informativo nesta entrega: a página MUST NOT bloquear nem alterar nada por causa da posição do ponto em relação a um raio. As lojas e as suas coordenadas MUST vir da leitura pública das lojas (`stores/storefront-stores`); a loja em vigor é a da vitrine (`loja` na URL, a escolha lembrada no navegador ou a primeira loja ativa), casada pelo slug.

#### Scenario: Mapa centrado na Loja Paulista
- **WHEN** um usuário sem ponto abre `/minha-conta?loja=loja-paulista`
- **THEN** o mapa abre enquadrando a "Loja Paulista" com todo o círculo de atendimento dela visível, com o marcador da loja e sem marcador do cliente

#### Scenario: Mapa centrado na Loja Rio Branco
- **WHEN** um usuário sem ponto abre `/minha-conta?loja=loja-rio-branco`
- **THEN** o mapa abre centrado na "Loja Rio Branco"

#### Scenario: Mapa centrado no ponto do cliente
- **WHEN** um usuário com ponto gravado abre `/minha-conta`
- **THEN** o mapa abre centrado no ponto do cliente, com zoom de rua, e mostra o marcador do cliente

#### Scenario: Todas as lojas com o raio no mapa
- **WHEN** um usuário abre `/minha-conta?loja=loja-paulista` com as duas lojas do seed ativas
- **THEN** o mapa mostra o marcador e o círculo de atendimento da "Loja Paulista" e da "Loja Rio Branco", com a "Loja Paulista" em destaque, e a lista abaixo do mapa traz as duas lojas com o raio de cada uma

#### Scenario: Ver uma loja distante no mapa
- **WHEN** um usuário em `/minha-conta?loja=loja-paulista`, com o mapa na Loja Paulista, clica em "Ver no mapa" na "Loja Rio Branco"
- **THEN** a câmera vai para a Loja Rio Branco, mostrando o marcador e todo o círculo dela, e o ponto do cliente continua onde estava

#### Scenario: Ver todas as lojas
- **WHEN** um usuário clica em "Ver todas as lojas"
- **THEN** o mapa se ajusta para mostrar as duas lojas do seed ao mesmo tempo, sem mudar o ponto do cliente

#### Scenario: Ponto fora de todo raio continua salvável
- **WHEN** um usuário marca um ponto fora do círculo de todas as lojas e clica em "Salvar dados"
- **THEN** o ponto é salvo normalmente, sem aviso nem bloqueio por causa do raio

#### Scenario: Loja inativa fora do mapa
- **WHEN** um administrador desativa a "Loja Rio Branco" e um usuário abre `/minha-conta`
- **THEN** o mapa e a lista mostram só a "Loja Paulista"

### Requirement: Sugestão de endereço ao marcar o ponto
Um clique no mapa ou o fim do arraste do marcador do cliente SHALL gravar o ponto no formulário (6 casas decimais, contando como alteração) e pedir a sugestão de endereço desse ponto (`GET /geocoding/reverse`). A sugestão MUST ser pedida só no clique e no fim do arraste, nunca durante o arraste, e uma resposta que chegar depois de um ponto mais novo ter sido marcado MUST ser descartada. O marcador MUST ficar onde o usuário o colocou, e não nas coordenadas do endereço sugerido.

Um cartão de status SHALL exibir:
- "Buscando endereço…" enquanto espera;
- em sucesso, "Endereço sugerido: <endereço formatado>" com os botões "Usar este endereço" e "Dispensar"; sem número na sugestão, também "Confira o número depois de usar o endereço."; com sugestão simulada, o aviso de busca simulada;
- sem endereço para o ponto (`404`), "Não encontramos um endereço para este ponto. Preencha os campos abaixo.", sem apagar o ponto.

Com o serviço indisponível (`503`), o sistema MUST exibir a mensagem de erro em um toaster, sem apagar o ponto.

Marcar o ponto MUST NOT mudar os campos do endereço. "Usar este endereço" MUST preencher os campos com os componentes não nulos da sugestão (CEP formatado), manter o complemento e os campos cujos componentes vieram nulos, validar os campos e fechar o cartão. "Dispensar" MUST fechar o cartão sem mudar os campos nem o ponto.

#### Scenario: Marcar o ponto e usar a sugestão
- **WHEN** um usuário sem cadastro clica em um ponto próximo à Loja Paulista, espera a sugestão e clica em "Usar este endereço"
- **THEN** o marcador fica no ponto clicado, o cartão mostra "Endereço sugerido: …", e depois do clique CEP, logradouro, número, bairro, cidade e UF são preenchidos com a sugestão e o cartão fecha

#### Scenario: Sugestão não sobrescreve sozinha
- **WHEN** um usuário com o endereço de Fortaleza preenchido clica em um ponto do mapa e a sugestão chega
- **THEN** os campos continuam com o endereço de Fortaleza até ele clicar em "Usar este endereço"

#### Scenario: Sugestão sem número
- **WHEN** a sugestão do ponto marcado vem com `number: null` e o usuário clica em "Usar este endereço"
- **THEN** o cartão exibia "Confira o número depois de usar o endereço.", e o campo número e o complemento mantêm os valores anteriores

#### Scenario: Ponto sem endereço
- **WHEN** o usuário marca um ponto para o qual a API responde `404`
- **THEN** o cartão exibe "Não encontramos um endereço para este ponto. Preencha os campos abaixo." e o marcador continua no ponto

#### Scenario: Resposta atrasada descartada
- **WHEN** o usuário clica em um ponto A e, antes da sugestão de A chegar, clica em um ponto B
- **THEN** o cartão mostra só a sugestão de B, mesmo que a resposta de A chegue depois

### Requirement: Localizar no mapa o endereço digitado
Acima do mapa, o botão "Localizar endereço no mapa" SHALL ficar habilitado quando logradouro e cidade estiverem preenchidos. Ao clicar, o sistema MUST localizar o endereço digitado (`GET /geocoding` com logradouro, número, bairro, cidade/UF e CEP, sem complemento), mover o marcador e a câmera para o resultado, gravar esse ponto no formulário e exibir "Endereço encontrado: <endereço formatado>", e MUST NOT mudar os campos do endereço. Endereço não encontrado e serviço indisponível MUST exibir a mensagem de erro correspondente, sem mudar o ponto.

#### Scenario: Localizar endereço digitado
- **WHEN** um usuário com cadastro em Fortaleza digita outro logradouro, número e cidade e clica em "Localizar endereço no mapa"
- **THEN** o marcador e a câmera vão para o resultado, "Endereço encontrado: …" é exibido e os campos continuam como foram digitados

#### Scenario: Botão desabilitado sem logradouro
- **WHEN** o logradouro ou a cidade do formulário estão vazios
- **THEN** o botão "Localizar endereço no mapa" fica desabilitado

### Requirement: Aviso de ponto desatualizado
Depois de o ponto ser marcado no mapa, localizado pelo endereço ou de a sugestão ser usada, se o usuário mudar à mão CEP, logradouro, número, bairro, cidade ou UF, a página SHALL exibir "O endereço mudou depois de o ponto ser marcado. Confira o ponto no mapa." com o botão "Localizar endereço no mapa". Mudar só o complemento MUST NOT exibir o aviso. O aviso MUST NOT apagar o ponto, e MUST sumir quando o ponto for marcado de novo, localizado ou removido.

#### Scenario: Número alterado depois do ponto
- **WHEN** um usuário localiza o endereço no mapa, salva e depois muda o número
- **THEN** a página exibe "O endereço mudou depois de o ponto ser marcado. Confira o ponto no mapa." e o marcador continua no ponto anterior

#### Scenario: Complemento não desatualiza o ponto
- **WHEN** um usuário com ponto marcado muda só o complemento
- **THEN** o aviso de ponto desatualizado não é exibido

### Requirement: Remover o ponto
Quando houver ponto, a página SHALL exibir a ação "Remover ponto", que MUST apagar o ponto do formulário (contando como alteração), esconder o marcador do cliente e o cartão de sugestão. Ao salvar, o cadastro MUST ficar sem ponto.

#### Scenario: Remover e salvar
- **WHEN** um usuário com ponto gravado clica em "Remover ponto" e em "Salvar dados"
- **THEN** o marcador do cliente some e `GET /me/customer` passa a devolver `address.location = null`

### Requirement: Mapa simulado
Sem a chave pública do mapa, ou quando o provedor do mapa recusar a chave, a página SHALL exibir o mapa simulado (a mesma ilustração e o selo "Mapa simulado" do cadastro de loja) com o botão "Usar ponto de exemplo" e a lista das lojas ativas com o raio de cada uma, já que o mapa simulado não desenha marcadores nem círculos. O botão MUST marcar o ponto da loja escolhida na vitrine (ou, sem ela, o ponto de exemplo da Avenida Paulista) e seguir o mesmo fluxo de sugestão, localização, aviso de ponto desatualizado e remoção. Com a chave recusada, MUST exibir também o aviso de falha do mapa usado no cadastro de loja.

#### Scenario: Sem chave pública
- **WHEN** o frontend roda sem chave pública do mapa e o usuário clica em "Usar ponto de exemplo" em `/minha-conta?loja=loja-paulista`
- **THEN** a página mostra o selo "Mapa simulado", marca o ponto da "Loja Paulista" e exibe a sugestão simulada com o aviso de busca simulada

### Requirement: Telas sem mapa preservam o ponto
O passo de entrega do checkout e a edição de cliente na área administrativa SHALL continuar só com os campos, sem mapa, e MUST devolver ao salvar o ponto que receberam do cadastro, sem editá-lo, de modo que salvar por essas telas não apague nem mude o ponto marcado em "Minha conta".

#### Scenario: Alterar dados de entrega no checkout
- **WHEN** um usuário com ponto gravado clica em "Alterar" no passo de entrega do checkout, muda o telefone e salva
- **THEN** `GET /me/customer` devolve o novo telefone e o mesmo `address.location` de antes

#### Scenario: Edição administrativa do cliente
- **WHEN** um administrador edita o bairro de um cliente com ponto gravado na área administrativa e salva
- **THEN** o cliente continua com o mesmo `address.location`
