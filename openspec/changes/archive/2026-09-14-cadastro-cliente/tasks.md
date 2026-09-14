> **Execução:** os grupos 1 (Negócio), 2–3 (Backend) e 4–8 (Frontend) rodam em subagentes separados, com contexto limpo, **nessa ordem**. Um grupo só começa depois de o anterior terminar com as validações passando.
>
> **Leitura prévia de cada subagente:**
> - todos: `.claude/skills/skills-standards.md`, o prompt `openspec/extras/prompts/11-cadastro-cliente.md` e os arquivos equivalentes de `brand` na sua camada;
> - Frontend, além disso: `apps/frontend/DESIGN.md` e `apps/frontend/src/modules/orders/pages/checkout.page.tsx`.
>
> Cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.

## 1. Domínio `@jaja/customers` (subagente Negócio)

- [x] 1.1 Remover o scaffold `modules/customers/src/customers`, `modules/customers/test/customers` e `modules/customers/test/mock/in-memory-customers.repository.ts`, deixando `src/index.ts` só com `getModuleName()`. Verificar que `npm test --workspace=@jaja/customers` passa só com `test/index.test.ts`.
- [x] 1.2 Gerar o agregado com a skill `module-aggregate` (`customer`, `--mode example`) e apagar o use case e o teste de exemplo gerados, mantendo `src/customer/{model,provider,dto}` e `test/mock/in-memory-customer.repository.ts`. Verificar com `find modules/customers/src modules/customers/test -type f` que não resta arquivo de exemplo nem nome no plural (`customers.entity.ts`, `create-customers*`).
- [x] 1.3 Criar `src/customer/errors.ts` (`CustomerErrors` com `CUSTOMER_NOT_FOUND`, `CUSTOMER_ALREADY_EXISTS`, `CUSTOMER_CPF_ALREADY_EXISTS`, `CUSTOMER_USER_NOT_FOUND`, `CUSTOMER_ZIP_CODE_INVALID` e `CUSTOMER_STATE_INVALID`, além do tipo `CustomerErrorCode`) e, com a skill `module-value-object`, os VOs `model/zip-code.vo.ts` (`ZipCode`, 8 dígitos com ou sem traço, getter `formatted`) e `model/state-code.vo.ts` (`StateCode`, 27 UFs, maiúsculas, exportando `BRAZILIAN_STATE_CODES`). Verificar em `test/customer/zip-code.vo.test.ts` e `state-code.vo.test.ts`:
  - CEP com e sem traço;
  - CEP com letras ou com 7 dígitos falhando com `CUSTOMER_ZIP_CODE_INVALID`;
  - `formatted` igual a `60150-160`;
  - `"ce"` virando `CE`;
  - `"XX"` falhando com `CUSTOMER_STATE_INVALID`.
- [x] 1.4 Criar `model/customer-address.vo.ts` (`CustomerAddress`, VO composto como `ProductImage`) com `zipCode`, `street` (2–120), `number` (1–10), `complement` (opcional, até 80; vazio vira `null`), `neighborhood` (2–60), `city` (2–60) e `state`, validados com `Result.combine`, com getters e `toDTO()`. Verificar em `test/customer/customer-address.vo.test.ts`:
  - campos obrigatórios em branco falham;
  - `street` com 121 caracteres falha;
  - `number: "S/N"` é aceito;
  - `complement: ""` vira `null`.
- [x] 1.5 Implementar `model/customer.entity.ts` (skill `module-entity`) com `id`, `userId` (`Id`), `cpf` (`Cpf`), `phone` (`Phone`), `address` (`CustomerAddress`), `isActive` (`Flag`, padrão `true`), `create`/`tryCreate`, getters e `toDTO()`. Verificar em `test/customer/customer.entity.test.ts`:
  - CPF com máscara normalizado para dígitos;
  - dígito verificador errado falha com `CPF_INVALID_CHECK_DIGIT`;
  - `111.111.111-11` falha com `CPF_REPEATED_SEQUENCE`;
  - telefone `9999` falha com `PHONE_INVALID_LENGTH`;
  - `userId` inválido falha;
  - endereço inválido falha;
  - `isActive` vale `true` por padrão.
- [x] 1.6 Criar `dto/customer.dto.ts` (`CustomerAddressDTO`, `CustomerDTO`, `CustomerDetailDTO`, `CustomerListItemDTO`, `CustomerPageDTO`) e `dto/customer-filters.dto.ts` (`CustomerFiltersDTO`) (skill `module-dto`). Criar `provider/customer.repository.ts` (`CustomerRepository extends CrudRepository<Customer>` com `findByUserId` e `findByCpf` retornando `Result<Customer | null>`) (skill `module-repository`) e as queries `provider/find-customers.query.ts`, `find-customer-by-id.query.ts` e `find-customer-by-user-id.query.ts` (skill `module-query-cqrs`). Verificar com `npx tsc --noEmit -p modules/customers`.
- [x] 1.7 Ajustar `test/mock/in-memory-customer.repository.ts` às restrições do banco:
  - `userId` e `cpf` únicos também entre excluídos, falhando com `CUSTOMER_ALREADY_EXISTS` e `CUSTOMER_CPF_ALREADY_EXISTS`;
  - `create` com id existente, `update`/`delete` de inexistente ou excluído e `findById` sem registro falham com `CUSTOMER_NOT_FOUND`;
  - `delete` preenche `deletedAt`, e as buscas ignoram excluídos.

  Verificar com `npx tsc --noEmit -p modules/customers` e com os testes da tarefa 1.8.
- [x] 1.8 Implementar `use-case/save-customer.use-case.ts` (skill `module-use-case`) conforme a Decisão 5 do `design.md`:
  - sem `id`, localiza por `findByUserId`, cria (`isActive = true`) ou altera, e ignora `isActive`;
  - com `id`, localiza por `findById`, altera aplicando `isActive` e propaga `CUSTOMER_NOT_FOUND` sem criar;
  - antes de verificar a unicidade, normaliza o CPF com `Cpf.tryCreate`; a verificação por `findByCpf` ignora o próprio cliente e falha com `CUSTOMER_CPF_ALREADY_EXISTS`;
  - na alteração, usa `cloneWith` substituindo o endereço e `updatedAt`, sem mudar `userId`;
  - retorna `CustomerDTO`.

  Verificar em `test/customer/save-customer.use-case.test.ts`:
  - criação pelo `userId`;
  - segunda chamada com o mesmo `userId` alterando o mesmo `id`;
  - `userId` ausente ou inválido;
  - `isActive: false` ignorado sem `id`;
  - CPF de outro cliente rejeitado na criação e na alteração, inclusive com máscara diferente;
  - próprio CPF aceito;
  - alteração por `id` aplicando `isActive`;
  - `id` inexistente com `CUSTOMER_NOT_FOUND` e nenhum cliente criado;
  - `userId` enviado com `id` não altera o vínculo.
- [x] 1.9 Criar `src/customer/index.ts` (reexporta `dto`, `errors`, `model`, `provider` e `use-case`) e exportar `./customer` em `src/index.ts`. Verificar:
  - `npm test --workspace=@jaja/customers` passa;
  - `npm run build --workspace=@jaja/customers` gera um `dist/index.d.ts` que exporta `Customer`, `CustomerErrors`, `CustomerRepository`, `FindCustomersQuery`, `FindCustomerByIdQuery`, `FindCustomerByUserIdQuery` e `SaveCustomer`;
  - o `dist/index.d.ts` não contém `Customers` nem `CreateCustomers`.

## 2. Backend: banco e adapter (subagente Backend)

- [x] 2.1 Mapear o model `Customer` em `apps/backend/prisma/models/customers.model.prisma` (skill `backend-prisma-data`):
  - tabela `customers`, com `id` uuid;
  - `userId @unique` com relação para `User`, `onDelete: Restrict`;
  - `cpf @unique @db.Char(11)` e `phone`;
  - `zipCode @db.Char(8)`, `street`, `number`, `complement?`, `neighborhood`, `city` e `state @db.Char(2)`;
  - `isActive @default(true)`, colunas snake_case, `createdAt`/`updatedAt`/`deletedAt`;
  - comentário sobre o vínculo 1:1, as chaves reservadas e o upsert do seed por `userId`.

  Adicionar a relação inversa `customer Customer?` em `User` (`auth.model.prisma`). Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name customers_customer` e `npm run prisma:generate --workspace=@jaja/backend`. Verificar que a migration só cria a tabela `customers`, os índices `customers_user_id_key` e `customers_cpf_key` e a FK `customers_user_id_fkey`, sem alterar colunas de `users`.
- [x] 2.2 Mover `apps/backend/src/modules/catalog/text-search.sql.ts` para `apps/backend/src/db/text-search.sql.ts` e ajustar os imports de `brand.prisma.ts` e `category.prisma.ts`. Verificar:
  - `grep -rn "text-search.sql" apps/backend/src` só aponta para `db/text-search.sql.js`;
  - `npm run build --workspace=@jaja/backend` compila.
- [x] 2.3 Criar `apps/backend/src/modules/customers/customer.prisma.ts` (`CustomerPrisma implements CustomerRepository`) no padrão de `brand.prisma.ts`:
  - métodos com `toDomain`/`fromDomain`, `Result.tryAsync` e client da transação;
  - `delete` como soft delete, e todas as leituras com `deletedAt: null`;
  - com id que não é uuid, `findById` falha com `CUSTOMER_NOT_FOUND` e `findByUserId` retorna `null`;
  - `UNIQUE_VIOLATIONS` (`customers_user_id_key`, `customers_cpf_key`, `customers_pkey`) e P2003 `customers_user_id_fkey` → `CUSTOMER_USER_NOT_FOUND`, lidos também de `meta.driverAdapterError.cause.constraint`.

  Verificar que o backend compila (o comportamento é validado na tarefa 3.5).
- [x] 2.4 Adicionar a `CustomerPrisma` as queries públicas `findCustomers` (Decisão 8 do `design.md`), `findCustomerById` e `findCustomerByUserId`:
  - todas com join em `users`, trazendo `name` e `email`;
  - `findCustomers` com `count` + `LIMIT/OFFSET`, `tsvector` A (nome, email, CPF) e B (telefone, bairro), `ts_rank` quando há busca, termos com máscara reduzidos a dígitos e ordenação `users.name COLLATE "pt-BR-x-icu", customers.id`;
  - `findCustomerById` e `findCustomerByUserId` retornam `null` para inexistente, excluído ou id não uuid.

  Verificar que o backend compila.
- [x] 2.5 Apagar `customers.controller.ts` e `customers.prisma.ts`; em `customers.module.ts`, registrar `CustomerPrisma` em `providers`/`exports` (os controllers entram em 3.1 e 3.2) e ajustar `index.ts`. Verificar:
  - `grep -rn "CustomersController\|CustomersPrisma" apps/backend/src` não encontra nada;
  - o backend compila.

## 3. Backend: API, seed e integração (subagente Backend)

- [x] 3.1 Criar `apps/backend/src/modules/customers/customer-http.ts` (`SaveCustomerBody`, `toInput` só com os campos conhecidos, incluindo o `address`, e `throwFailure` com códigos deduplicados: `CUSTOMER_NOT_FOUND`/`CUSTOMER_USER_NOT_FOUND` → `404`, `CUSTOMER_CPF_ALREADY_EXISTS`/`CUSTOMER_ALREADY_EXISTS` → `409`, demais → `400`). Criar também `customer.controller.ts` (skill `backend-controller`), com `@Controller('customers')` e `@AdminOnly()`:
  - `GET /customers`, com `page`/`pageSize` padrão e limite 100, `search` com trim e `isActive` só `"true"`/`"false"`;
  - `GET /customers/:id`, com `404` quando `null`;
  - `PUT /customers/:id`, com o id da rota e `userId` do corpo descartado;
  - sem `POST` nem `DELETE`.

  Registrar em `customers.module.ts`. Verificar que o backend compila.
- [x] 3.2 Criar `my-customer.controller.ts` com `@Controller('me/customer')` e `@UseGuards(JwtGuard)` na classe:
  - `GET /me/customer` usa `findCustomerByUserId` com `@CurrentUser('id')` e responde `404 [CUSTOMER_NOT_FOUND]` quando `null`;
  - `PUT /me/customer` executa `SaveCustomer` com `userId` do token, descartando `id`/`userId`/`isActive` do corpo.

  Registrar em `customers.module.ts`. Verificar que o backend compila.
- [x] 3.3 Gerar `apps/backend/prisma/seed/data/customers.json` com um script descartável fora do repositório, conforme "Dados de referência" do prompt:
  - 40 itens `{ userEmail, cpf, phone, address }`, para os 40 primeiros usuários `admin: false` de `users.json`;
  - CPFs fictícios válidos e únicos, só dígitos;
  - telefone `85` + 9 dígitos começando com `9`;
  - CEP `60xxxxxx`, Fortaleza/CE, nos oito bairros da vitrine;
  - cerca de metade com complemento.

  Verificar com um `node -e` que:
  - são 40 itens, sem administradores nem emails repetidos;
  - todos os emails existem em `users.json`;
  - todo CPF é aceito por `Cpf.tryCreate` e os CPFs são únicos.

  Verificar também que nenhum script foi versionado.
- [x] 3.4 Criar `apps/backend/prisma/seed/tasks/customers.seed.ts` (`seedCustomers`):
  - caminho resolvido por `import.meta.url`, com erro claro quando o arquivo não existe;
  - mapa `email` → `id` carregado com `findMany`;
  - item sem usuário gera aviso e é ignorado;
  - `upsert` por `userId` com `randomUUID()` e `update: {}`.

  Registrar em `seedTasks` de `prisma/seed/main.ts` como `customers`, após `auth`. Rodar `npm run prisma:seed --workspace=@jaja/backend` duas vezes e verificar, por SQL no container, que:
  - existem 40 clientes após cada execução;
  - nenhum é de usuário com `admin = true`;
  - os CPFs são distintos;
  - `usuario@formacao.dev` e `admin@jaja.dev` não têm cliente.
- [x] 3.5 Criar `apps/backend/src/modules/customers/test/customer.integration.http` no estilo de `brand.integration.http`:
  - variáveis `@baseUrl`, `@adminEmail`, `@userEmail` (usuário comum com cliente no seed), `@seedPassword` e `@missingId`;
  - `@cpf`/`@otherCpf` como `# @prompt`;
  - usuário novo registrado com email de timestamp, seguido de login;
  - requisições nomeadas para reaproveitar ids e o CPF de um cliente do seed.

  Cobrir os cenários de `/me/customer` e `/customers` listados no prompt: 401, 404 sem cadastro, 400 de CPF/CEP/UF, criação com `isActive` ignorado, alteração com o mesmo `id` e `complement: null`, 409 de CPF, 403, lista com `search` por nome e por CPF com máscara, `isActive=true`, busca por id 200/404, alteração administrativa com `isActive: false`, `PUT` de id inexistente 404 e cliente desativado sem se reativar. Subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000) e verificar que cada chamada retorna o status e os códigos esperados.
- [x] 3.6 Verificar que `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` passam sem erros, e que, com o backend no ar:
  - `POST /auth/login` continua respondendo `200`;
  - `GET /brands?search=hp` e `GET /categories?search=papel` continuam retornando resultados após a mudança de `text-search.sql.ts`.

## 4. Frontend: base compartilhada (subagente Frontend)

- [x] 4.1 Adicionar em `src/shared/i18n/messages.pt.ts` e `messages.en.ts`, na ordem alfabética das chaves, as mensagens de `CUSTOMER_ALREADY_EXISTS`, `CUSTOMER_CPF_ALREADY_EXISTS`, `CUSTOMER_NOT_FOUND`, `CUSTOMER_STATE_INVALID`, `CUSTOMER_USER_NOT_FOUND`, `CUSTOMER_ZIP_CODE_INVALID`, `CPF_INVALID_CHECK_DIGIT`, `CPF_INVALID_FORMAT`, `CPF_INVALID_LENGTH`, `CPF_REPEATED_SEQUENCE`, `PHONE_INVALID_FORMAT`, `PHONE_INVALID_LENGTH` e `TEXT_TOO_SHORT`, com os textos do prompt. Verificar que as chaves existem nos dois arquivos e que o frontend compila.
- [x] 4.2 Extrair `withQuery` de `src/shared/navigation/catalog-routes.ts` para `src/shared/navigation/with-query.util.ts` e importá-lo em `catalog-routes.ts`. Em `customers-routes.ts`, criar `customersRoute(query?)` e `customerRoute(id, query?)`, mantendo `CUSTOMERS_ROUTE`. Verificar:
  - `grep -rn "function withQuery" apps/frontend/src` só encontra o novo arquivo;
  - `npm run lint --workspace=@jaja/frontend` passa.

## 5. Frontend: dados de clientes (subagente Frontend)

- [x] 5.1 Criar `src/modules/customers/data/customer.api.ts`, com os tipos `Customer`, `CustomerAddress`, `CustomerDetail`, `CustomerListItem`, `CustomerPage`, `CustomerInput` e `CustomerFilter` e as funções sobre `apiRequest`, todas com `token` como primeiro parâmetro:
  - `listCustomers` (a query string só leva filtros definidos);
  - `getCustomer` e `updateCustomer` (id com `encodeURIComponent`);
  - `getMyCustomer` (`404` com `CUSTOMER_NOT_FOUND` → `null`; demais erros propagados);
  - `saveMyCustomer`.

  Verificar que o frontend compila.
- [x] 5.2 Criar `data/customer.util.ts` com `onlyDigits`, `formatCpf`, `formatPhone` (10 e 11 dígitos), `formatZipCode`, `formatCustomerAddress` (sem complemento quando `null`) e `BRAZILIAN_STATES` (sigla e nome das 27 UFs). Criar também `data/customer.schema.ts` (skill `frontend-form-schema`), com `customerSchema`:
  - CPF e telefone validados por refinamentos com `Cpf.tryCreate`/`Phone.tryCreate` do shared (Decisão 10 do `design.md`);
  - CEP com 8 dígitos;
  - limites do endereço iguais aos do domínio, exportados como constantes;
  - UF dentre `BRAZILIAN_STATES`;
  - `isActive` e o tipo `CustomerFormData`.

  Verificar que o frontend compila e que o schema rejeita `cpf: "529.982.247-26"` e `zipCode: "6015-160"` e aceita `cpf: "529.982.247-25"`.
- [x] 5.3 Criar o mapa código → campo compartilhado em `data/` (`CUSTOMER_CPF_ALREADY_EXISTS`/`CPF_*` → `cpf`, `PHONE_*` → `phone`, `CUSTOMER_ZIP_CODE_INVALID` → `address.zipCode`, `CUSTOMER_STATE_INVALID` → `address.state`). Criar também os hooks:
  - `use-customers.hook.ts`, no padrão de `use-brands.hook.ts`: `page`, `search` e `isActive` na URL, debounce voltando à página 1, página além da última redirecionada e `listQuery`, sem `remove`;
  - `use-customer-form.hook.ts`, só edição: carrega por id, com falha → toaster e volta à lista; expõe `name`/`email`; envia sem máscaras, com complemento vazio como `null`; em sucesso, toaster "Cliente atualizado" e `listHref`; erros por campo via o mapa.

  Atualizar `data/index.ts`. Verificar que `npm run lint --workspace=@jaja/frontend` passa.
- [x] 5.4 Criar os hooks da loja:
  - `data/use-my-customer.hook.ts`: chaveado pelo token da sessão; sem sessão, `customer = null` sem chamada; expõe `customer`, `loading`, `hasCustomer` e `save(input)`; erro de carregamento em toaster;
  - `data/use-customer-delivery-form.hook.ts`: iniciado com o cliente ou com `defaults`; em sucesso, toaster "Dados de entrega salvos" e `onSaved`; erros por campo pelo mesmo mapa.

  Verificar que `npm run lint --workspace=@jaja/frontend` passa.

## 6. Frontend: telas administrativas (subagente Frontend)

- [x] 6.1 Criar `src/modules/customers/components/customer-address-fields.component.tsx`, com CEP com máscara, logradouro, número, complemento, bairro, cidade e UF (`Combobox` com `BRAZILIAN_STATES`), cada campo com `FormErrorMessage` e recebendo o `form`. Verificar que o frontend compila.
- [x] 6.2 Criar `components/customer-list.component.tsx`:
  - `TableCard` + `Table`, com nome e email, `formatCpf`, `formatPhone`, bairro com cidade/UF, badge "Ativo"/"Inativo" e editar levando `listQuery`;
  - `EmptyListState` "Nenhum cliente ainda" e estado de busca próprio.

  Criar também `pages/customers.page.tsx` (`CustomersPage` e `CustomersPageSkeleton`):
  - cabeçalho "Clientes" com a contagem, sem botão de criação;
  - busca `role="search"` com o placeholder do prompt e seletor de status;
  - `aria-busy` nas recargas e `PaginationControls` com `totalLabel: "clientes"`.

  Verificar que o frontend compila.
- [x] 6.3 Criar `components/customer-form.component.tsx`: página sem modal, com `FormSectionLayout` em `Card` e as seções **Conta** (`ReadonlyTextField` + texto de apoio), **Documento e contato**, **Endereço de entrega** e **Situação** (`Checkbox`), mais os botões salvar/cancelar. Criar também `pages/customer-form.page.tsx` (`CustomerFormPage({ id, returnQuery })`, com "Editar cliente", "← Voltar para clientes" e `FormSkeleton`). Verificar que o frontend compila.
- [x] 6.4 Trocar `src/app/admin/(shell)/customers/page.tsx` para `CustomersPage` em `<Suspense fallback={<CustomersPageSkeleton />}>` e criar `(shell)/customers/[id]/page.tsx`, que aguarda `params`/`searchParams` e renderiza `<CustomerFormPage key={id} ... />`. Apagar `components/customers-dashboard.component.tsx` e `pages/dashboard.page.tsx` e atualizar `src/modules/customers/index.ts`. Verificar:
  - `grep -rn "CustomersDashboardComponent" apps/frontend/src` não encontra nada;
  - `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` passam;
  - o build lista `/admin/customers` e `/admin/customers/[id]`.

## 7. Frontend: dados de entrega no checkout (subagente Frontend)

- [x] 7.1 Criar os componentes da loja:
  - `components/customer-delivery-form.component.tsx`: CPF e telefone lado a lado em telas largas, `customer-address-fields`, botão "Salvar dados de entrega" ("Salvando…" durante o envio) e "Cancelar" só quando já há cadastro, no visual do checkout;
  - `components/customer-delivery-summary.component.tsx`: `formatCustomerAddress`, `formatPhone` e o botão "Alterar".

  Exportá-los em `src/modules/customers/index.ts`. Verificar que o frontend compila.
- [x] 7.2 Integrar o passo 1 de `src/modules/orders/pages/checkout.page.tsx` com `useMyCustomer()`:
  - estados de carregamento (esqueleto do card), criação, resumo e alteração;
  - na criação, o texto "Precisamos destes dados uma vez só: ficam salvos para os próximos pedidos." e `defaults` com `neighborhood = storefront.neighborhood`, `city = "Fortaleza"` e `state = "CE"`;
  - remoção dos campos mockados "Endereço", "Complemento" e "Andar / sala";
  - "Quem recebe" e "Instruções para o entregador" mantidos abaixo, sem salvar no cliente;
  - aviso de cobertura mantido.

  Verificar que `npm run lint --workspace=@jaja/frontend` passa e que `grep -n "Av. Santos Dumont" apps/frontend/src/modules/orders/pages/checkout.page.tsx` não encontra nada.
- [x] 7.3 Em `checkout.page.tsx`, incluir `hasCustomer && !editing` em `canConfirm` e exibir "Preencha os dados de entrega para confirmar o pedido." abaixo do botão quando faltar, mantendo a confirmação mock (`nextOrderId`). Verificar:
  - `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` passam;
  - na tarefa 8.2, o comportamento do botão.

## 8. Verificação integrada e fechamento (subagente Frontend)

- [x] 8.1 Com o banco semeado, backend e frontend no ar e o painel do navegador visível, entrar como `usuario@formacao.dev` em `/admin/customers` e verificar os cenários de `customers/customer-admin`:
  - 40 clientes em 2 páginas, com CPF e telefone formatados e sem ações de criar ou excluir;
  - busca por nome e por CPF com máscara refletida na URL;
  - filtro de status e reload preservando a lista;
  - `?page=9` indo para a página 2;
  - edição com CPF de outro cliente mostrando o erro no campo;
  - desativar, voltando à mesma página com "Inativo";
  - `/admin/customers/new` voltando para a lista com toaster.
- [x] 8.2 Na loja, verificar os cenários de `orders/checkout-access`:
  - **conta nova criada em `/checkout?bairro=Aldeota&categoria=todas`:** formulário com Aldeota, Fortaleza e CE; "Confirmar pedido" desabilitado com o texto de pendência; validação no navegador sem chamada à API; salvar mostrando o toaster e o resumo;
  - **cliente com cadastro:** "Alterar" + "Cancelar" sem salvar; reload mostrando o resumo;
  - **CPF de um cliente do seed:** erro no campo CPF;
  - **troca de conta:** sair e entrar com um usuário que já tem cadastro no seed mostra direto o resumo dele (o cabeçalho compacto do `/checkout` não tem "Sair" desde o commit `fa20034`, conforme `apps/frontend/DESIGN.md`; a saída é feita pelo menu da conta no cabeçalho da vitrine, voltando depois a `/checkout`).
- [ ] 8.3 Verificar que não houve regressão ("sair" em `/checkout` exercido pelo menu da conta na vitrine, pelo mesmo motivo da 8.2):
  - `/admin/catalog/brands`, `/admin/catalog/categories` e `/admin/catalog/products` continuam listando e buscando;
  - `/entrar` e `/admin/login` continuam exibindo "Email ou senha inválidos" e "Este email já está cadastrado";
  - "sair" em `/checkout` volta ao formulário de entrar/criar conta.

> **Ao arquivar esta change:** ajustar à mão o `## Purpose` de `openspec/specs/orders/checkout-access/spec.md`, que hoje exclui o endereço da capacidade, para mencionar o passo de dados de entrega (deltas não alteram o Purpose).
