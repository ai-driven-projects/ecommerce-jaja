## Context

O app tem sessão (etapa 8: `AuthRepository`/`Session`, `AuthInterceptor`, guarda `resolveSessionRedirect` com `AppRoutes.sessionRequiredPaths`, hoje vazio) e a aba Conta com "Olá, <primeiro nome>", nome, e-mail e "Sair". Ainda não existe o domínio `customer`. O plano reserva para esta etapa o `GET`/`PUT /me/customer` na aba Conta, sem mapa, com a `location` preservada.

Contrato (só leitura): `MyCustomerController` e `customer-http.ts` em `apps/backend/src/modules/customers/`. O `GET` devolve `CustomerDetailDTO` (`id`, `userId`, `cpf` e `phone` só com dígitos, `address` com `zipCode` de 8 dígitos, `state` em maiúsculas, `complement` e `location` anuláveis, `isActive`, datas, `name`, `email`). Sem cadastro, responde `404 [CUSTOMER_NOT_FOUND]`. O `PUT` recebe `{cpf, phone, address{zipCode, street, number, complement, neighborhood, city, state, location}}` e devolve `CustomerDTO` (sem `name`/`email`). Ele cria ou altera o cadastro do usuário do token. `CUSTOMER_*_NOT_FOUND` → `404`, `CUSTOMER_CPF_ALREADY_EXISTS`/`CUSTOMER_ALREADY_EXISTS` → `409`, o resto → `400`. Para `address.location` no `PUT`, ausente mantém o ponto atual, `null` remove e um objeto substitui.

Regras (fonte): `Cpf` e `Phone` em `packages/shared/src/vo/{cpf,phone}.vo.ts`; `ZipCode`, `StateCode` (`BRAZILIAN_STATE_CODES`) e `CUSTOMER_ADDRESS_LIMITS` em `modules/customers/src/customer/model/`. Comportamento e textos: `apps/frontend/src/modules/customers/` (`my-account.page.tsx`, `my-account-form.component.tsx`, `customer-address-fields.component.tsx`, `data/customer-form.util.ts`, `customer.util.ts`, `phone.util.ts`) e as mensagens de `apps/frontend/src/shared/i18n/messages.pt.ts`. O `mapHttpFailure` entregue transforma `404` em `NotFoundFailure` **sem códigos**, e outro `4xx` em `BackendRejectionFailure(statusCode, codes)`.

## Goals / Non-Goals

**Goals:** domínio `customer` puro com value objects e contrato; cliente HTTP de `/me/customer` com a `location` sempre explícita; tela "Dados de entrega" na pilha da aba Conta, com sessão obrigatória; recusas nos campos.

**Non-Goals (ficam para outras etapas):**
- Checkout: exigir os dados de entrega, o resumo do endereço e "Alterar" no fechamento, destinatário e instruções, e os erros `ORDER_CUSTOMER_*` ficam para a etapa 12, que reusa o `CustomerRepository` e os value objects desta etapa.
- Varredura de textos, testes finais de DI e rotas e o `docs/lacunas-da-api.md` ficam para a etapa 15.
- Em nenhuma etapa (fora do plano): mapa, ponto, sugestão de endereço, geocodificação (`/geocoding`), lista de lojas com raio, edição de nome, e-mail ou senha.

## Decisions

### 1. Value objects (`lib/core/value_objects/`)
São regras sobre um valor (regra 8 do `CLAUDE.md`). Todos seguem o molde "entrada inválida é erro": construtor privado e `static Result<T> create(String)`. Cada um tem um enum de código novo em `app_failure.dart`, e as mensagens são as do web.
- `Cpf`: cópia de `cpf.vo.ts`, com aparo, só `[0-9.\- ]`, 11 dígitos, sem sequência repetida e os dois dígitos verificadores (`(soma*10) % 11`, 10 → 0). Guarda os dígitos e tem `formatted` (`000.000.000-00`). Toda falha diz "CPF inválido." (`CpfCode.invalidFormat/invalidLength/repeatedSequence/invalidCheckDigit`).
- `Phone`: cópia de `phone.vo.ts`, com aparo, só `^\+?[0-9.\-/ ()]+$` e 8 a 15 dígitos. Guarda os dígitos. Toda falha diz "Telefone inválido.".
- `ZipCode`: `^\d{5}-?\d{3}$` depois do aparo. Guarda 8 dígitos e tem `formatted` (`60150-160`). Falha: "CEP inválido.".
- `StateCode`: as 27 siglas de `BRAZILIAN_STATE_CODES`, com aparo e maiúsculas. Falha: "UF inválida.".
- `BoundedText.create(input, {min, max})`: aparado, com "O texto não atingiu o tamanho mínimo permitido." ou "O texto passou do tamanho máximo permitido." (`TEXT_TOO_SHORT`/`TEXT_TOO_LONG` do `Text` do shared). Complemento vazio é aceito fora do VO (vira `null`).
- As máscaras de digitação ficam na UI (Decisão 6). Os VOs aceitam texto com ou sem máscara, como a API.

### 2. Domínio (`lib/modules/customer/`)
- `model/customer_entity.dart` (`freezed`): `Customer(id, cpf, phone, address)`, `CustomerAddress(zipCode, street, number, complement?, neighborhood, city, state, location?)` e `CustomerLocation(latitude, longitude)`. Os campos são `String` crus, como a API devolve. `name`/`email` não entram: a tela usa os da sessão, como o web.
- `model/customer_rules.dart`: os limites de `CUSTOMER_ADDRESS_LIMITS`, com a origem num comentário, e `CustomerDraft` (classe imutável à mão, com `cpf`, `phone`, `zipCode`, `state` já normalizados pelos VOs, os textos aparados, `complement` `null` quando vazio e `location` **obrigatório no construtor**, anulável). `CustomerDraft.validate(fields, {required CustomerLocation? location})` roda todos os VOs e devolve `Result<CustomerDraft>` ou o mapa de erros por campo (Decisão 5). Os campos do formulário são um record/classe `CustomerFields` com os nove textos.
- `errors/customer_errors.dart`: `enum CustomerField { cpf, phone, zipCode, street, number, complement, neighborhood, city, state }` e `enum CustomerErrorCode` com `backendCode`, `message` e `field`: `cpfAlreadyExists` (`CUSTOMER_CPF_ALREADY_EXISTS`, "Este CPF já está cadastrado.", cpf), `zipCodeInvalid`, `stateInvalid`, e os grupos `CPF_*` → cpf "CPF inválido." e `PHONE_*` → phone "Telefone inválido." (um valor por código do backend). `customerFieldErrorsFromCodes(List<String>)` devolve `Map<CustomerField, String>`, com o primeiro código de cada campo, na ordem recebida.
- `provider/customer_repository.dart`: `Future<Result<Customer?>> fetchMine()` (`null` = sem cadastro) e `Future<Result<Customer>> saveMine(CustomerDraft draft)`. Nada é guardado entre chamadas: cada abertura busca de novo.
- `usecase/load_delivery_details.dart`: junta dois repositórios (regra 4). `LoadDeliveryDetails(CustomerRepository, StoreRepository)` devolve `Result<DeliveryDetails(customer, defaultPlace)>`. Com cadastro, não consulta lojas. Sem cadastro, `defaultPlace = pickCurrentStore(stores, chosenSlug)?.place`. Falha das lojas dá `defaultPlace: null`, sem falhar a carga. A falha do `fetchMine` é devolvida.

### 3. Infra (`lib/infra/api/customer_dto.dart`, `lib/infra/customer/api_customer_repository.dart`)
- `parseCustomer(Object?)` lê o `CustomerDetailDTO` e o `CustomerDTO` (ignora `name`, `email`, `userId`, `isActive` e as datas; `complement`/`location` podem ser `null`; coordenadas `num` → `double`). `encodeCustomerDraft(draft)` monta o corpo e **sempre** inclui a chave `address.location` (objeto ou `null`). O ponto nunca é omitido nem calculado.
- `ApiCustomerRepository(Dio)`: `fetchMine` = `GET /me/customer` por `runRequest`. Uma `Failure(NotFoundFailure)` vira `Ok(null)` (o `mapHttpFailure` descarta os códigos do `404`; nesse caminho o `404` vem de `CUSTOMER_NOT_FOUND`/`CUSTOMER_USER_NOT_FOUND`). `saveMine` = `PUT /me/customer` com `encodeCustomerDraft`. As falhas passam sem tradução: a tradução para campo é do ViewModel, pelos `codes`.
- **Preservação:** quem monta o `CustomerDraft` passa `location: loaded?.address.location`. É o ponto exatamente como chegou no `GET`, e `null` sem cadastro. Como o construtor exige `location`, nenhum caminho o esquece. O teste do repositório prova o ida e volta: `GET` com ponto → rascunho → `PUT` com o mesmo ponto.

### 4. Rota e aba Conta
- `AppRoutes.deliveryDetails = '/account/delivery'` (segmento `delivery`, filha de `/account` no ramo da aba), em `sessionRequiredPaths`. A guarda existente cobre a falta de sessão e a expiração. O teste que exige a lista vazia passa a exigir só essa rota.
- `AccountPage` ganha `onOpenDeliveryDetails` e, com sessão, a entrada "Dados de entrega" (`AppButton` `secondary`, `xl`, `expand`, entre o e-mail e "Sair"). O `builder` da rota usa `context.go(AppRoutes.deliveryDetails)`.

### 5. `DeliveryDetailsViewModel` (`lib/ui/modules/customer/view_models/`)
- Recebe `LoadDeliveryDetails`, `CustomerRepository` e `AuthRepository` (para o nome e o e-mail de `currentUser`). Registrado com `registerFactory`. O caso de uso entra na DI como factory.
- `details`: `BlockState<DeliveryDetails>` (`load()` no `initState` da página e no "Tentar de novo"). Ao carregar, monta os `initial` (`CustomerFields`): com cadastro, CPF, telefone e CEP passados pelas máscaras da Decisão 6; sem cadastro, vazios com `city`/`state` de `defaultPlace`. Guarda também o `loadedLocation`.
- `fields` (atual), `update(CustomerField, String)`, `isDirty` (`fields != initial`) e `discard()` (volta ao `initial`, limpa os erros e incrementa `formRevision`, que a página observa para reescrever os controllers).
- `save`: `Command0<Customer>`. Marca `attempted` e valida (`CustomerDraft.validate(fields, location: loadedLocation)`). Inválido devolve `ValidationFailure` sem API. Válido chama `saveMine`. No `Ok`, `initial = fields` normalizados a partir da resposta, `loadedLocation` = a da resposta, e os erros do servidor são limpos. Numa `BackendRejectionFailure`, `customerFieldErrorsFromCodes` preenche `serverErrors`, e os códigos sem campo mantêm a mensagem genérica no `formError`. Outras falhas vão para o `formError` (`formErrorMessage` de `auth_form_messages.dart`).
- `errorOf(field)`: erro do servidor daquele campo (apagado quando o campo muda) ou, depois de `attempted`, o erro do VO.

### 6. Tela (`lib/ui/modules/customer/`)
- `DeliveryDetailsPage` (composição): `AppBar` "Dados de entrega" com voltar. `switch` no `BlockState`: skeleton dos cartões, `StateErrorBanner(title: 'Não foi possível carregar seus dados.')` ou o formulário. Rodapé fixo com "Salvar dados"/"Salvando…" (`AppButton` principal, `null` sem alteração ou durante o envio) e "Descartar alterações" (`ghost`, só com alteração). Sucesso → `SnackBar` "Dados salvos"; `formError` → `SnackBar` com a mensagem.
- Widgets: `AccountDataCard` (nome e e-mail só leitura e o texto de apoio), `PersonalDataFields` (CPF, telefone) e `AddressFields` (CEP, logradouro, número, complemento, bairro, cidade, UF em uma coluna, com os rótulos e exemplos do web). Os campos usam `AppTextField`, com `maxLength` pelos limites, e o teclado numérico/telefone no CPF, no telefone e no CEP. O `AppTextField` ganha `inputFormatters` e `textCapitalization` opcionais.
- `view_models/customer_masks.dart`: `formatCpfInput`, `formatPhoneInput` (cópia de `formatPhone` de `phone.util.ts`: 10 e 11 dígitos com DDD; acima de 11, só dígitos) e `formatZipCodeInput`, funções puras sobre texto parcial (cópias de `formatCpf`/`formatZipCode`), usadas pelo ViewModel ao carregar e pelos campos. `widgets/masked_input_formatter.dart` é o `TextInputFormatter` que aplica uma delas e põe o cursor no fim. A UF usa maiúsculas e `maxLength` 2.

### 7. `BlockState` em `ui/shared/`
Esta tela é o segundo consumidor fora do catálogo, então o arquivo vai para `lib/ui/shared/view_models/block_state.dart` sem mudar de forma, como o `CLAUDE.md` manda. Só os imports do catálogo e dos testes mudam (hoje não há teste próprio do `BlockState`).

### 8. `CLAUDE.md`
Só acréscimos: "Etapa 11" no estado atual. Em "Regras de domínio › Dados de entrega": `location` sempre explícita (a do `GET` ou `null`); `404` = sem cadastro; os VOs `Cpf`/`Phone`/`ZipCode`/`StateCode`/`BoundedText` como fonte única das regras; rota em `sessionRequiredPaths`. Em "Estados de tela remota", o novo caminho do `BlockState`.

## Dependências da etapa anterior

Conferidas no código entregue: `AuthRepository.currentUser`/`userChanges` e `AuthUser(name, email, isAdmin)`; `AccountPage` com `accountViewModelFactory`, `onOpenLogin` e `onOpenRegister`; `AppRoutes.account`, `sessionRequiredPaths` (`const Set`) e `requiresSession`; `session_redirect_test.dart` exigindo a lista vazia; `StoreRepository.fetchStores`/`readChosenSlug`, `pickCurrentStore` e `Store.place` (`CityState`); `runRequest`, `mapHttpFailure` e os tipos de `AppFailure`; `formErrorMessage`/`validationMessage`; `AppTextField` (sem `inputFormatters`); `StateErrorBanner({title, failure, onRetry})`; `SkeletonBox`; `registerFakeDependencies(...)` em `test/app/support/fake_dependencies.dart`; `FakeHttpClientAdapter` (`enqueueResponse`/`enqueueError`, `requests`) e `FakeStoreRepository`. Se um nome diferir, a aplicação segue o nome entregue e registra a diferença abaixo, com o prefixo do lote.

## Decisões tomadas sem consulta

- O plano fala em "nome, telefone e endereço". A API **exige CPF**, e o nome é da conta de acesso (não muda por `/me/customer`). Por isso a tela mostra nome e e-mail só para leitura e edita CPF, telefone e endereço, como o "Minha conta" do web.
- Os dados de entrega ficam numa tela empilhada na aba Conta (`/account/delivery`), e não dentro da própria aba, para manter "uma ação principal por tela" e deixar a aba com o perfil e "Sair".
- Sempre enviar `location` (a do `GET` ou `null`), como pede o plano, em vez de omitir a chave (o que faria a API manter o ponto atual). Ver Riscos.
- `404` sem códigos é tratado como "sem cadastro" (o `mapHttpFailure` não guarda códigos do `404`). Se for `CUSTOMER_USER_NOT_FOUND`, o `PUT` seguinte recebe o mesmo `404` e mostra a mensagem genérica.
- A UF é um campo de texto com 2 letras validado pelo `StateCode`, e não a lista de seleção do web. Nesta etapa não entra seletor.
- Mensagens dos limites de texto: as genéricas do web (`TEXT_TOO_SHORT`/`TEXT_TOO_LONG`), sem inventar texto por campo.
- Falha na carga mostra o banner padrão com "Tentar de novo" (o web mostra toaster e segue sem cadastro). Assim, o app não oferece um formulário vazio que sobrescreveria um cadastro existente.
- A máscara põe o cursor no fim a cada mudança, o que basta para digitar ou apagar no fim do campo e mantém o formatador simples.
- O cadastro não é guardado no app: cada abertura da tela busca de novo. O checkout (etapa 12) busca pelo mesmo repositório.
- Nenhuma lacuna de API: `apps/mobile/docs/lacunas-da-api.md` não é criado nesta etapa.

## Risks / Trade-offs

- [Ponto mudado no web enquanto a tela está aberta é sobrescrito pelo ponto carregado] → janela pequena (o ponto só muda no web); seguir o plano à risca. Cada abertura busca de novo.
- [Máscara com cursor no fim atrapalha editar no meio] → o VO aceita o texto com ou sem máscara, e o formatador refaz a máscara.
- [Recusa com código desconhecido] → cai na mensagem genérica do `BackendRejectionFailure`, sem perder o formulário.
