> **Leitura prévia:** `apps/mobile/CLAUDE.md`, e `proposal.md`, `design.md` (inclusive "Dependências da etapa anterior") e as specs `mobile/mobile-customer` e `mobile/mobile-session` desta change. Referência de comportamento (só leitura): os arquivos do web e do backend citados no Context do design.
>
> **Restrições:** escrever só em `apps/mobile` e nos arquivos desta change; nenhuma dependência nova; nada de `flutter run`, build ou emulador; sem commits. Testes em `apps/mobile/test/` espelhando `lib/`, fakes à mão em `test/**/support/`. Decisão nova durante a aplicação vai para "Decisões tomadas sem consulta" do `design.md`, prefixada com o lote.

## 1. Value objects

- [x] 1.1 Conferir os nomes de "Dependências da etapa anterior" no código; se algo divergir, seguir o código e registrar no `design.md`.
- [x] 1.2 Em `lib/core/errors/app_failure.dart`, os enums `CpfCode`, `PhoneCode`, `ZipCodeCode`, `StateCodeCode` e `TextCode` (Decisão 1).
- [x] 1.3 Criar `lib/core/value_objects/cpf.dart` e `phone.dart` (Decisão 1, cópia de `packages/shared/src/vo/{cpf,phone}.vo.ts`).
- [x] 1.4 Testes em `test/core/value_objects/{cpf,phone}_test.dart`: `529.982.247-25` e `52998224725` → dígitos e `formatted`; dígito errado, 10 dígitos, `111.111.111-11` e letra → "CPF inválido."; telefone com 7 e 16 dígitos ou letra → "Telefone inválido.", `(85) 99999-8888` → dígitos.
- [x] 1.5 Criar `lib/core/value_objects/{zip_code,state_code,bounded_text}.dart` (Decisão 1, origens de `modules/customers/src/customer/model/` e `text.vo.ts`).
- [x] 1.6 Testes em `test/core/value_objects/{zip_code,state_code,bounded_text}_test.dart`: `60150-160`/`60150160` válidos, `6015-0160` inválido; ` sp ` → `SP`, `XX` → "UF inválida."; texto aparado nos limites, curto e longo com as duas mensagens.

## 2. Domínio `customer`

- [x] 2.1 Criar `lib/modules/customer/model/customer_entity.dart` (`freezed`: `Customer`, `CustomerAddress`, `CustomerLocation`) e rodar o `build_runner` (Decisão 2).
- [x] 2.2 Criar `lib/modules/customer/errors/customer_errors.dart` com `CustomerField`, `CustomerErrorCode` e `customerFieldErrorsFromCodes` (Decisão 2).
- [x] 2.3 Criar `lib/modules/customer/model/customer_rules.dart` com os limites, `CustomerFields` e `CustomerDraft.validate` (Decisão 2).
- [x] 2.4 Criar `lib/modules/customer/provider/customer_repository.dart` e `usecase/load_delivery_details_use_case.dart` com `DeliveryDetails` (Decisão 2; sufixo `_use_case` pela convenção do `CLAUDE.md`).
- [x] 2.5 Testes em `test/modules/customer/errors/customer_errors_test.dart`: cada código vai ao seu campo e mensagem; dois códigos do CPF → o primeiro; código desconhecido fica de fora.
- [x] 2.6 Testes em `test/modules/customer/model/customer_rules_test.dart`: campos válidos → rascunho normalizado (dígitos, UF maiúscula, complemento vazio → `null`, `location` repassada); inválidos → um erro por campo.
- [x] 2.7 Criar `test/modules/customer/support/{customer_fixtures,fake_customer_repository}.dart` (fake com `enqueueFetch`/`enqueueSave`, `holdSave` e `saveCalls`).
- [x] 2.8 Testes em `test/modules/customer/usecase/load_delivery_details_use_case_test.dart`: com cadastro, sem consultar lojas; sem cadastro, a cidade/UF da loja lembrada (ou da primeira); falha das lojas → `defaultPlace` nulo; falha do cadastro devolvida.

## 3. Cliente de `/me/customer`

- [x] 3.1 Criar `test/infra/api/support/customer_json.dart` com o cadastro de Fortaleza com e sem `location`, a resposta do `PUT` e as recusas (`409` CPF, `400` com `CPF_INVALID_CHECK_DIGIT`/`PHONE_INVALID_LENGTH`, `404` `CUSTOMER_NOT_FOUND`).
- [x] 3.2 Criar `lib/infra/api/customer_dto.dart` com `parseCustomer` e `encodeCustomerDraft` (Decisão 3).
- [x] 3.3 Testes em `test/infra/api/customer_dto_test.dart`: parsing com e sem ponto e sem complemento; o corpo sempre tem `address.location` (objeto ou `null`); campo faltando → erro de parsing.
- [x] 3.4 Criar `lib/infra/customer/api_customer_repository.dart` (Decisão 3).
- [x] 3.5 Testes em `test/infra/customer/api_customer_repository_test.dart` (`Dio` + `FakeHttpClientAdapter`): `GET` `200` → `Customer`, `404` → `Ok(null)`, `500` → `ServerFailure`; `PUT` com método, caminho e corpo; `409` mantém `codes`.
- [x] 3.6 Teste de preservação no mesmo arquivo: `GET` com ponto → rascunho com `location` do cadastro → `PUT` com o mesmo ponto; sem cadastro → `"location": null`.
- [x] 3.7 Em `service_locator.dart`, `CustomerRepository` (lazy singleton) e `LoadDeliveryDetails` (factory); conferir em `service_locator_test.dart`.

## 4. `BlockState` e ViewModel

- [x] 4.1 Mover `block_state.dart` para `lib/ui/shared/view_models/` e ajustar os imports do catálogo e dos testes (Decisão 7); `flutter analyze` sem problemas.
- [x] 4.2 Criar `lib/ui/modules/customer/view_models/customer_masks.dart` e testes em `test/ui/modules/customer/view_models/customer_masks_test.dart` (texto parcial, 10 e 11 dígitos, mais de 11 sem máscara).
- [x] 4.3 Criar `delivery_details_view_model.dart` com carga, campos, `isDirty`, `discard`, `formRevision`, `save` e `errorOf` (Decisão 5); registrar com `registerFactory`.
- [x] 4.4 Testes de carga em `delivery_details_view_model_test.dart`: com cadastro → campos mascarados e sem alteração; sem cadastro → cidade/UF da loja; falha → `BlockFailed` e `load()` de novo.
- [x] 4.5 Testes de formulário: `update` deixa sujo, `discard` volta ao carregado e incrementa `formRevision`; erros só depois de tentar salvar; inválido não chama `saveMine`.
- [x] 4.6 Testes de gravação: o rascunho leva a `location` carregada (e `null` sem cadastro); sucesso deixa sem alteração; `409` → erro no CPF, que some ao editar o campo; `500` → `formError`.

## 5. Tela, aba Conta e rota

- [x] 5.1 Em `AppTextField`, `inputFormatters` e `textCapitalization` opcionais; criar `lib/ui/modules/customer/widgets/masked_input_formatter.dart` com teste do cursor no fim.
- [x] 5.2 Criar os widgets `AccountDataCard`, `PersonalDataFields` e `AddressFields` e a `DeliveryDetailsPage` (Decisão 6), com os textos como constantes públicas.
- [x] 5.3 Widget tests em `test/ui/modules/customer/pages/delivery_details_page_test.dart`: skeleton; banner "Não foi possível carregar seus dados." com "Tentar de novo"; sem cadastro → texto de apoio e cidade/UF; com cadastro → valores mascarados, nome e e-mail.
- [x] 5.4 Widget tests de rodapé: "Salvar dados" desabilitado sem alteração; editar mostra "Descartar alterações"; salvar → "Salvando…" e "Dados salvos"; CPF inválido mostra o erro no campo.
- [x] 5.5 Em `AppRoutes`, `deliveryDetails` em `sessionRequiredPaths` e a rota filha de `/account` no `app_router.dart`; `AccountPage` com "Dados de entrega" e `onOpenDeliveryDetails` (Decisão 4).
- [x] 5.6 Testes: `account_page_test.dart` (com sessão mostra "Dados de entrega" e chama o callback); `session_redirect_test.dart` passa a exigir só a nova rota; `app_router_test.dart` (sem sessão → `/login?from=/account/delivery`; com sessão abre a tela na aba Conta), com `registerFakeDependencies` aceitando o `FakeCustomerRepository`.

## 6. CLAUDE.md e verificação final

- [x] 6.1 Acrescentar ao `apps/mobile/CLAUDE.md` o que a Decisão 8 pede, sem afrouxar regra existente.
- [x] 6.2 `cd apps/mobile && dart run build_runner build --delete-conflicting-outputs` termina com sucesso e os `.freezed.dart` estão em dia.
- [x] 6.3 `cd apps/mobile && flutter analyze` sem nenhum problema.
- [x] 6.4 `cd apps/mobile && flutter test` com todos os testes passando, inclusive `test/core/architecture_test.dart`.
- [x] 6.5 `git status --short` mostra mudanças só em `apps/mobile/` e nesta change, sem `build/` nem `.dart_tool/`; registrar no `design.md` qualquer desvio do plano.
