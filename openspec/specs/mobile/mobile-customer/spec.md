# Dados de Entrega do App Mobile (Mobile Customer) Specification

## Purpose

Define os dados de entrega do cliente no app mobile Jajá: a tela aberta pela aba Conta que lê e grava o cadastro de cliente (CPF, telefone e endereço em texto, sem mapa) por `GET`/`PUT /me/customer`, preservando o ponto do endereço marcado no web.

## Requirements

### Requirement: Acesso aos dados de entrega
A tela "Dados de entrega" SHALL abrir pela aba Conta, na pilha da própria aba, com a barra de abas visível, e MUST exigir sessão. Sem sessão, abrir a tela MUST levar a "Entrar" com a tela como destino, e entrar MUST voltar para ela. Se a sessão expirar (`401`) com a tela aberta, o app MUST ir para "Entrar" com a tela como destino.

#### Scenario: Abrir pela aba Conta
- **WHEN** a cliente "Ana Souza" com sessão toca em "Dados de entrega" na aba Conta
- **THEN** a tela "Dados de entrega" abre na aba Conta, com a barra de abas visível

#### Scenario: Sem sessão
- **WHEN** uma pessoa sem sessão chega à rota dos dados de entrega e entra com credenciais válidas
- **THEN** a tela "Entrar" abre primeiro e, depois de entrar, a tela "Dados de entrega" aparece

### Requirement: Carga do cadastro
Ao abrir, a tela SHALL buscar o cadastro com `GET /me/customer`, mostrando skeleton no lugar do formulário enquanto espera. Uma falha MUST mostrar o banner "Não foi possível carregar seus dados." com a mensagem da falha e "Tentar de novo", que busca de novo. `404` MUST ser tratado como cliente sem cadastro, não como falha. A tela MUST mostrar o nome e o e-mail da conta da sessão só para leitura, com o texto "Nome e email são da sua conta de acesso.". Sem cadastro, MUST mostrar o texto "Preencha uma vez e seus pedidos saem mais rápido." e o formulário vazio, com a cidade e a UF da loja escolhida já preenchidas quando o endereço da loja as traz. Com cadastro, MUST mostrar o formulário com os dados atuais, com CPF, telefone e CEP mascarados.

#### Scenario: Cliente sem cadastro
- **WHEN** um cliente sem cadastro, com a "Loja Paulista" (endereço terminado em "São Paulo/SP") escolhida, abre a tela e `GET /me/customer` responde `404`
- **THEN** a tela mostra "Preencha uma vez e seus pedidos saem mais rápido.", CPF, telefone, CEP, logradouro, número, complemento e bairro vazios, cidade "São Paulo" e UF "SP"

#### Scenario: Cliente com cadastro
- **WHEN** um cliente com cadastro em Fortaleza (CPF `52998224725`, telefone `85999998888`, CEP `60150160`) abre a tela
- **THEN** o formulário mostra "529.982.247-25", "(85) 99999-8888", "60150-160" e os demais campos do endereço de Fortaleza

#### Scenario: Falha na carga
- **WHEN** `GET /me/customer` responde `500` e o cliente toca em "Tentar de novo"
- **THEN** o banner "Não foi possível carregar seus dados." dá lugar ao skeleton e uma nova busca é feita

### Requirement: Validação do formulário
O formulário SHALL ter CPF, telefone, CEP, logradouro, número, complemento (opcional), bairro, cidade e UF, com as mesmas regras da API, aplicadas depois de aparar o texto: CPF com 11 dígitos, sem sequência repetida e com dígitos verificadores válidos ("CPF inválido."); telefone com 8 a 15 dígitos ("Telefone inválido."); CEP com 8 dígitos, com ou sem hífen ("CEP inválido."); UF entre as 27 siglas, aceitando minúsculas ("UF inválida."); logradouro de 2 a 120 caracteres, número de 1 a 10, complemento até 80, bairro e cidade de 2 a 60, com as mensagens "O texto não atingiu o tamanho mínimo permitido." e "O texto passou do tamanho máximo permitido.". Os erros MUST aparecer nos campos só depois da primeira tentativa de salvar, e um formulário inválido MUST NOT chamar a API.

#### Scenario: CPF inválido
- **WHEN** o cliente informa o CPF "529.982.247-24" e toca em "Salvar dados"
- **THEN** o campo CPF mostra "CPF inválido." e nenhum `PUT /me/customer` é enviado

#### Scenario: Logradouro curto
- **WHEN** o cliente deixa o logradouro com "A" e toca em "Salvar dados"
- **THEN** o campo logradouro mostra "O texto não atingiu o tamanho mínimo permitido."

### Requirement: Salvar e descartar
O rodapé SHALL ter "Salvar dados", desabilitado enquanto não houver alteração e com "Salvando…" durante o envio, e "Descartar alterações", exibido só quando houver alteração, que volta aos valores carregados. Salvar MUST enviar `PUT /me/customer` com CPF, telefone e CEP só com dígitos, UF em maiúsculas, complemento vazio como `null` e o endereço inteiro, criando o cadastro quando ele não existir. No sucesso, MUST mostrar "Dados salvos" e deixar o formulário sem alteração pendente, com os valores salvos.

#### Scenario: Salvar
- **WHEN** um cliente com cadastro muda o telefone para "(85) 98888-7777" e toca em "Salvar dados"
- **THEN** sai `PUT /me/customer` com `"phone":"85988887777"`, aparece "Dados salvos" e "Salvar dados" volta a ficar desabilitado

#### Scenario: Descartar alterações
- **WHEN** um cliente com cadastro muda o telefone e toca em "Descartar alterações"
- **THEN** o telefone volta ao valor carregado, "Descartar alterações" some e "Salvar dados" fica desabilitado

### Requirement: Ponto do endereço preservado
O app SHALL preservar o ponto do endereço: sem mapa, MUST NOT criar, mudar nem apagar o ponto. O corpo de `PUT /me/customer` MUST sempre levar `address.location`: com cadastro, o ponto exatamente como `GET /me/customer` o devolveu (inclusive `null`); sem cadastro, `null`. Mudar os campos do endereço MUST NOT mudar o ponto enviado.

#### Scenario: Cadastro com ponto marcado no web
- **WHEN** um cliente cujo `GET /me/customer` traz `location` `{"latitude":-3.731862,"longitude":-38.526669}` muda o número e salva
- **THEN** o `PUT /me/customer` leva o novo número e `location` `{"latitude":-3.731862,"longitude":-38.526669}`

#### Scenario: Cliente novo
- **WHEN** um cliente sem cadastro preenche os dados válidos e salva
- **THEN** o `PUT /me/customer` leva `"location":null`

### Requirement: Recusas do backend ao salvar
Uma recusa de `PUT /me/customer` SHALL mostrar a mensagem no campo correspondente: `CUSTOMER_CPF_ALREADY_EXISTS` → "Este CPF já está cadastrado." no CPF; `CPF_*` → "CPF inválido." no CPF; `PHONE_*` → "Telefone inválido." no telefone; `CUSTOMER_ZIP_CODE_INVALID` → "CEP inválido." no CEP; `CUSTOMER_STATE_INVALID` → "UF inválida." na UF. Os outros códigos e as falhas sem código (rede, servidor) MUST aparecer como mensagem do formulário, sem perder o que foi digitado.

#### Scenario: CPF de outro cliente
- **WHEN** o cliente salva e a API responde `409` com `CUSTOMER_CPF_ALREADY_EXISTS`
- **THEN** o campo CPF mostra "Este CPF já está cadastrado." e o formulário continua com as alterações pendentes

#### Scenario: Servidor fora
- **WHEN** o cliente salva e a API responde `500`
- **THEN** aparece a mensagem "O servidor está indisponível no momento. Tente novamente em instantes." e os campos mantêm o que foi digitado
