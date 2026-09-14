> **Execução:** os grupos 1 (Negócio), 2–3 (Backend) e 4–7 (Frontend) rodam em subagentes separados, com contexto limpo, **nessa ordem**. Um grupo só começa depois de o anterior terminar com as validações passando.
>
> **Leitura prévia de cada subagente:**
> - todos: `.claude/skills/skills-standards.md`, o prompt `openspec/extras/prompts/10-cadastro-loja.md`, o `design.md` desta change e os arquivos equivalentes de `brand` (módulo `catalog`) na sua camada;
> - Negócio, além disso: `modules/catalog/src/product/model/product-image.vo.ts` e `modules/catalog/src/product/errors.ts`;
> - Frontend, além disso: `apps/frontend/DESIGN.md` e `apps/frontend/src/modules/catalog/data/product.schema.ts`.
>
> **Nenhum subagente grava chaves reais em arquivos versionados.** Cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.
>
> **Change em andamento `cadastro-cliente`:** as tarefas 2.2, 4.2, 4.3 e 4.4 tocam arquivos compartilhados com ela. Antes de cada uma, conferir se a outra change já fez a parte comum e, nesse caso, só reaproveitar (Decisão 11 do `design.md`).

## 1. Domínio `@jaja/stores` (subagente Negócio)

- [x] 1.1 Remover o scaffold `modules/stores/src/stores`, `modules/stores/test/stores` e `modules/stores/test/mock/in-memory-stores.repository.ts`, deixando `src/index.ts` só com `getModuleName()`. Verificar que `npm test --workspace=@jaja/stores` passa só com `test/index.test.ts`.
- [x] 1.2 Gerar o agregado com a skill `module-aggregate` (`store`, `--mode example`) e apagar o use case e o teste de exemplo gerados, mantendo `src/store/{model,provider,dto}` e `test/mock/in-memory-store.repository.ts`. Verificar com `find modules/stores/src modules/stores/test -type f` que não resta arquivo de exemplo nem nome no plural (`stores.entity.ts`, `create-store*`).
- [x] 1.3 Criar `src/store/errors.ts` com:
  - `StoreErrors`: `STORE_NOT_FOUND`, `STORE_NAME_ALREADY_EXISTS`, `STORE_SLUG_ALREADY_EXISTS`, `GEO_POINT_LATITUDE_INVALID`, `GEO_POINT_LONGITUDE_INVALID` e `DELIVERY_RADIUS_INVALID`;
  - o tipo `StoreErrorCode`;
  - as constantes `STORE_MIN_DELIVERY_RADIUS_METERS = 300`, `STORE_MAX_DELIVERY_RADIUS_METERS = 10000` e `STORE_DEFAULT_DELIVERY_RADIUS_METERS = 1000`.

  Criar também, com a skill `module-value-object`, `model/geo-point.vo.ts` (`GeoPoint`, VO com dois campos, como `ProductImage`: latitude de −90 a 90, longitude de −180 a 180, números finitos arredondados para 6 casas) e `model/delivery-radius.vo.ts` (`DeliveryRadius`, inteiro de 300 a 10.000). Verificar em `test/store/geo-point.vo.test.ts` e `delivery-radius.vo.test.ts`:
  - latitude `91`/`-91` falha com `GEO_POINT_LATITUDE_INVALID`, e longitude `181`/`-181` com `GEO_POINT_LONGITUDE_INVALID`;
  - latitude e longitude ausentes falham com os dois códigos;
  - `-3.73561234` vira `-3.735612`;
  - raios `300` e `10000` são aceitos; `299`, `10001` e `1500.5` falham com `DELIVERY_RADIUS_INVALID`.
- [x] 1.4 Implementar `model/store.entity.ts` (skill `module-entity`) com `id`, `name` (`Name`), `slug` (`Alias`, com `static resolveSlug`), `phone` (`Phone`, opcional), `address` (`Text` opcional até 200; vazio vira `null`), `latitude`/`longitude` (`GeoPoint`), `deliveryRadiusMeters` (`DeliveryRadius`, padrão 1.000), `isActive` (`Flag`, padrão `true`), `create`/`tryCreate`, getters e `toDTO()`. Verificar em `test/store/store.entity.test.ts`:
  - atributos válidos;
  - "Hub Cocó" gera o slug `hub-coco`;
  - `"(85) 3000-1001"` vira `8530001001`, e `"9999"` falha com `PHONE_INVALID_LENGTH`;
  - `address` com 201 caracteres falha, e `""` vira `null`;
  - coordenadas ausentes falham com os dois códigos de `GeoPoint`;
  - raio padrão de 1.000 m e `isActive` padrão `true`.
- [x] 1.5 Criar `dto/store.dto.ts` (`StoreDTO`, `StorePageDTO`) e `dto/store-filters.dto.ts` (`StoreFiltersDTO`) com a skill `module-dto`. Criar `provider/store.repository.ts` (`StoreRepository extends CrudRepository<Store>`, com `findBySlug` e `findByName` sem distinção de maiúsculas, retornando `Result<Store | null>`) com a skill `module-repository`. Criar `provider/find-stores.query.ts` e `find-store-by-id.query.ts` com a skill `module-query-cqrs`. Verificar com `npx tsc --noEmit -p modules/stores`.
- [x] 1.6 Criar `src/geocoding/` com:
  - `errors.ts`: `GeocodingErrors` com `GEOCODING_ADDRESS_REQUIRED`, `GEOCODING_ADDRESS_NOT_FOUND` e `GEOCODING_UNAVAILABLE`, e o tipo `GeocodingErrorCode`;
  - `dto/geocoding-result.dto.ts`: `GeocodingResultDTO` com `latitude`, `longitude`, `formattedAddress` e `source: 'google' | 'mock'`;
  - `provider/geocoding.provider.ts`: `GeocodingProvider.geocode(address): Promise<Result<GeocodingResultDTO | null>>`;
  - `index.ts`.

  Verificar com `npx tsc --noEmit -p modules/stores`.
- [x] 1.7 Ajustar `test/mock/in-memory-store.repository.ts` às restrições do banco:
  - `name` (sem distinção de maiúsculas) e `slug` únicos também entre excluídos, falhando com `STORE_NAME_ALREADY_EXISTS` e `STORE_SLUG_ALREADY_EXISTS`;
  - `create` com id existente, `update`/`delete` de inexistente ou excluído e `findById` sem registro falham com `STORE_NOT_FOUND`;
  - `delete` preenche `deletedAt`, e as buscas ignoram excluídos.

  Verificar com `npx tsc --noEmit -p modules/stores` e com os testes das tarefas 1.8 e 1.9.
- [x] 1.8 Implementar `use-case/save-store.use-case.ts` (skill `module-use-case`):
  - sem `id`, cria com `Id.createUUID()`;
  - `id` malformado falha;
  - `findById` encontrando → alteração; falhando com `STORE_NOT_FOUND` → criação com o `id` informado; outras falhas são propagadas;
  - verifica o nome (`findByName`) e depois o slug resolvido (`findBySlug`), ignorando a própria loja;
  - na criação, `isActive = true` e raio de 1.000 m por padrão;
  - na alteração, usa `cloneWith` (`undefined` mantém; `null`/`''` limpa `phone` e `address`), com `updatedAt: new Date()` e slug omitido mantendo o atual;
  - retorna `StoreDTO`.

  Verificar em `test/store/save-store.use-case.test.ts`:
  - criação e criação com o `id` informado;
  - `id` malformado;
  - nome duplicado com outra caixa e slug duplicado;
  - alteração sem conflito com o próprio nome;
  - alteração mantendo o slug quando não enviado;
  - alteração movendo o ponto, mudando o raio e limpando telefone e endereço;
  - duas lojas com raios sobrepostos aceitas.
- [x] 1.9 Implementar `use-case/delete-store.use-case.ts`: busca por id (falha `STORE_NOT_FOUND`) e soft delete. Verificar em `test/store/delete-store.use-case.test.ts` a exclusão e a exclusão de loja inexistente.
- [x] 1.10 Criar `src/store/index.ts` (reexporta `dto`, `errors`, `model`, `provider` e `use-case`) e exportar `./store` e `./geocoding` em `src/index.ts`. Verificar:
  - `npm test --workspace=@jaja/stores` passa;
  - `npm run build --workspace=@jaja/stores` gera um `dist/index.d.ts` que exporta `Store`, `StoreErrors`, `StoreRepository`, `FindStoresQuery`, `FindStoreByIdQuery`, `SaveStore`, `DeleteStore`, `GeocodingProvider` e `GeocodingErrors`;
  - o `dist/index.d.ts` não contém `Stores` nem `CreateStores`.

## 2. Backend: banco, busca e adapter (subagente Backend)

- [x] 2.1 Mapear o model `Store` em `apps/backend/prisma/models/stores.model.prisma` (skill `backend-prisma-data`):
  - tabela `stores`, com `id` uuid;
  - `name @unique` e `slug @unique`, `phone String?` e `address String?`;
  - `latitude Float`, `longitude Float` e `deliveryRadiusMeters Int @default(1000)`;
  - `isActive @default(true)`, colunas snake_case e `createdAt`/`updatedAt`/`deletedAt`;
  - comentário sobre as chaves reservadas para excluídos, o upsert do seed por `slug`, as coordenadas em graus decimais (WGS 84) e o raio em metros, em linha reta, informativo.

  Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name stores_store` e `npm run prisma:generate --workspace=@jaja/backend`. Verificar que a migration só cria a tabela `stores`, com `stores_name_key`, `stores_slug_key`, `latitude`/`longitude` `DOUBLE PRECISION` e `delivery_radius_meters` com padrão `1000`.
- [x] 2.2 Garantir `apps/backend/src/db/text-search.sql.ts`. Se o arquivo ainda estiver em `src/modules/catalog/`, movê-lo e ajustar os imports de `brand.prisma.ts` e `category.prisma.ts`; se `cadastro-cliente` já o moveu, não fazer nada. Verificar:
  - `grep -rn "text-search.sql" apps/backend/src` só aponta para `db/text-search.sql.js`;
  - `npm run build --workspace=@jaja/backend` compila.
- [x] 2.3 Criar `apps/backend/src/modules/stores/store.prisma.ts` (`StorePrisma implements StoreRepository`) no padrão de `brand.prisma.ts`:
  - métodos com `toDomain`/`fromDomain`, `Result.tryAsync` e client da transação;
  - `delete` como soft delete, e todas as leituras com `deletedAt: null`;
  - com id que não é uuid, `findById` falha com `STORE_NOT_FOUND`;
  - `findByName` sem distinção de maiúsculas;
  - em `create`/`update`, antes de gravar, uma checagem de nome sem distinção de maiúsculas que **inclui lojas excluídas** (ignorando o próprio id) e falha com `STORE_NAME_ALREADY_EXISTS`, porque `name @unique` do Postgres diferencia maiúsculas e a spec reserva o nome de lojas excluídas sem distinção de caixa (mesma regra do mock in-memory);
  - `UNIQUE_VIOLATIONS`: `stores_name_key` → `STORE_NAME_ALREADY_EXISTS`, `stores_slug_key` → `STORE_SLUG_ALREADY_EXISTS` e `stores_pkey` → `STORE_NOT_FOUND`, lidos também de `meta.driverAdapterError.cause.constraint`.

  Verificar que o backend compila; o comportamento é validado na tarefa 3.5.
- [x] 2.4 Adicionar a `StorePrisma` as queries públicas `findStores: FindStoresQuery` e `findStoreById: FindStoreByIdQuery` (Decisão 10 do `design.md`):
  - `count` + `LIMIT/OFFSET`;
  - `tsvector` com peso A (`name`, `slug`) e B (`address`), `toPrefixTsQuery` e `ts_rank` quando há busca;
  - ordenação `name COLLATE "pt-BR-x-icu", id`;
  - `findStoreById` retorna `null` para inexistente, excluído ou id não uuid.

  Verificar que o backend compila.
- [x] 2.5 Apagar `stores.controller.ts` e `stores.prisma.ts`; em `stores.module.ts`, registrar `StorePrisma` em `providers`/`exports` e ajustar `index.ts`. Verificar:
  - `grep -rn "StoresController\|StoresPrisma" apps/backend/src` não encontra nada;
  - o backend compila.

## 3. Backend: API, geocodificação, seed e integração (subagente Backend)

- [x] 3.1 Criar `store.controller.ts` (skill `backend-controller`), com `@Controller('stores')` e `@AdminOnly()` na classe:
  - `POST /stores`, descartando `id` do corpo;
  - `GET /stores`, com `page`/`pageSize` padrão e limite 100, `search` com trim e `isActive` só `"true"`/`"false"`;
  - `GET /stores/:id`, com `404 [STORE_NOT_FOUND]` quando `null`;
  - `PUT /stores/:id`, com o id da rota prevalecendo;
  - `DELETE /stores/:id`, respondendo `204`;
  - `SaveStoreBody` + `toInput` só com os campos conhecidos;
  - falhas deduplicadas: `STORE_NOT_FOUND` → `404`; `STORE_NAME_ALREADY_EXISTS`/`STORE_SLUG_ALREADY_EXISTS` → `409`; demais → `400`.

  Registrar em `stores.module.ts`. Verificar que o backend compila.
- [x] 3.2 Criar `google-geocoding.provider.ts` e `mock-geocoding.provider.ts` conforme a Decisão 6 do `design.md`:
  - Google: `fetch` com `address`, `key`, `language=pt-BR`, `region=br` e `AbortSignal.timeout(5000)`; `OK` → primeiro resultado arredondado; `ZERO_RESULTS` → ok com `null`; demais status, erro de rede e timeout → `GEOCODING_UNAVAILABLE`; `Logger` só com o status e o `error_message`;
  - mock: sempre `-23.561414`/`-46.655881`, `"Avenida Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200"` e `source: 'mock'`.

  Criar `google-geocoding.provider.spec.ts` e `mock-geocoding.provider.spec.ts` (Vitest, com `vi.stubGlobal('fetch', ...)`) e verificar que `npm run test --workspace=@jaja/backend` cobre:
  - `OK` com as coordenadas arredondadas e `source: 'google'`;
  - `ZERO_RESULTS` → `null`;
  - `REQUEST_DENIED` e erro de rede → `GEOCODING_UNAVAILABLE`;
  - nenhuma chamada de log contendo o valor da chave;
  - o mock devolvendo sempre o mesmo ponto sem chamar `fetch`.
- [x] 3.3 Em `stores.module.ts`:
  - registrar o token `GEOCODING_PROVIDER` com `useFactory` + `ConfigService`: `GoogleGeocodingProvider` com `GOOGLE_MAPS_API_KEY` preenchida, `MockGeocodingProvider` sem ela, com um `Logger.warn` único na inicialização;
  - criar `geocoding.controller.ts` (`@Controller('geocoding')`, `@AdminOnly()`): `GET /geocoding?address=` com trim, `400 [GEOCODING_ADDRESS_REQUIRED]` abaixo de 3 caracteres, `200` com o resultado, `404 [GEOCODING_ADDRESS_NOT_FOUND]` para `null` e `503 [GEOCODING_UNAVAILABLE]` na falha.

  Adicionar `GOOGLE_MAPS_API_KEY=` com comentário a `apps/backend/.env.example`. Verificar que o backend compila e que, subindo sem a chave, o log mostra o aviso de geocodificação simulada.
- [x] 3.4 Criar `apps/backend/prisma/seed/data/stores.json` com os dois hubs de "Dados de referência" do prompt (`name`, `slug`, `phone`, `address`, `latitude`, `longitude`, `deliveryRadiusMeters`). Criar `prisma/seed/tasks/stores-stores.seed.ts` (`seedStoresStores`):
  - caminho por `import.meta.url`, com erro claro quando o arquivo não existe;
  - `upsert` por `slug` com `randomUUID()` e `update: {}`.

  Registrar em `seedTasks` como `stores-stores`, após `catalog-products`. Rodar `npm run prisma:seed --workspace=@jaja/backend` duas vezes e verificar, por SQL no container:
  - 2 lojas após cada execução, ambas com raio de 2.500 m e latitude entre −3,8 e −3,7;
  - após mudar o raio do `hub-aldeota` para 3.000 por SQL e rodar `npx prisma db seed -- --only=stores` em `apps/backend`, o raio continua 3.000; depois, restaurar o valor.
- [x] 3.5 Criar `apps/backend/src/modules/stores/test/store.integration.http` e `geocoding.integration.http`, no estilo de `brand.integration.http`:
  - variáveis `@baseUrl`, `@adminEmail`, `@userEmail`, `@seedPassword` e `@missingId`;
  - nomes com sufixo de timestamp e requisições nomeadas para reaproveitar ids.

  Cobrir em `/stores`:
  - 401 e 403;
  - criação completa (201) e criação só com nome e coordenadas (201, raio 1.000);
  - `id` no corpo ignorado;
  - nome duplicado com outra caixa (409) e slug duplicado (409);
  - latitude 91 (400), raio 299 (400), telefone `9999` (400) e endereço com 201 caracteres (400);
  - raios sobrepostos (201);
  - listagem com `search=silva paulet` e `pageSize=500`;
  - busca por id (200/404, inclusive `abc`);
  - alteração movendo o ponto e limpando telefone/endereço (200);
  - `PUT` de loja excluída (404);
  - exclusão (204, seguida de 404).

  Cobrir em `/geocoding`:
  - 401 e 403;
  - endereço em branco (400);
  - endereço de uma loja do seed (200 com `source: "mock"` e o ponto da Avenida Paulista, sem chave).

  Subir o backend sem `GOOGLE_MAPS_API_KEY` (`npm run dev --workspace=@jaja/backend`, porta 4000) e verificar que cada chamada retorna o status e os códigos esperados.
- [x] 3.6 Verificar que `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` passam sem erros, e que, com o backend no ar:
  - `POST /auth/login` continua respondendo `200`;
  - `GET /brands?search=hp` e `GET /categories?search=papel` continuam retornando resultados após a mudança de `text-search.sql.ts`.

## 4. Frontend: base compartilhada (subagente Frontend)

- [x] 4.1 Instalar `@vis.gl/react-google-maps@^1.10.0` (`npm install ... --workspace=@jaja/frontend`) e adicionar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=` e `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=` a `apps/frontend/.env.example`, com os comentários da Decisão 7 do `design.md`. Verificar que a dependência está em `apps/frontend/package.json` e que `npm run lint --workspace=@jaja/frontend` passa.
- [x] 4.2 Adicionar em `src/shared/i18n/messages.pt.ts` e `messages.en.ts`, na ordem alfabética das chaves, as mensagens de `STORE_NOT_FOUND`, `STORE_NAME_ALREADY_EXISTS`, `STORE_SLUG_ALREADY_EXISTS`, `GEO_POINT_LATITUDE_INVALID`, `GEO_POINT_LONGITUDE_INVALID`, `DELIVERY_RADIUS_INVALID`, `GEOCODING_ADDRESS_REQUIRED`, `GEOCODING_ADDRESS_NOT_FOUND` e `GEOCODING_UNAVAILABLE`. Adicionar também `PHONE_INVALID_FORMAT` e `PHONE_INVALID_LENGTH`, só se ainda não existirem. Verificar que cada chave aparece uma única vez em cada arquivo e que o frontend compila.
- [x] 4.3 Garantir `src/shared/navigation/with-query.util.ts`: se `withQuery` ainda for privado de `catalog-routes.ts`, extraí-lo e importá-lo lá; se `cadastro-cliente` já o extraiu, só reaproveitar. Em `stores-routes.ts`, manter `STORES_ROUTE` e criar `STORES_STORES_ROUTE`, `storesStoresRoute(query?)`, `STORES_STORE_NEW_ROUTE`, `storesStoreNewRoute(query?)` e `storesStoreRoute(id, query?)`. Verificar:
  - `grep -rn "function withQuery" apps/frontend/src` só encontra `with-query.util.ts`;
  - `npm run lint --workspace=@jaja/frontend` passa.
- [x] 4.4 Garantir `formatPhone` em `src/shared/util/phone.util.ts` (`(85) 3000-1001` e `(85) 99999-9999`; valor vazio vira "—" em quem exibe). Se `cadastro-cliente` já criou `formatPhone` em `modules/customers/data/customer.util.ts`, mover para o shared e importar nos dois módulos. Verificar:
  - `grep -rn "function formatPhone" apps/frontend/src` encontra uma única definição;
  - o frontend compila.

## 5. Frontend: dados de lojas (subagente Frontend)

- [x] 5.1 Criar `src/modules/stores/data/store.api.ts`, com os tipos `Store`, `StorePage`, `StoreInput` e `StoreFilter` e as funções `listStores`, `getStore`, `createStore`, `updateStore` e `deleteStore` sobre `apiRequest`, com `token` como primeiro parâmetro, ids com `encodeURIComponent` e a query string só com os filtros definidos. Criar também `data/geocoding.api.ts` (`GeocodingResult`, `geocodeAddress(token, address)`). Verificar que o frontend compila.
- [x] 5.2 Criar `data/store-location.util.ts` com:
  - `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_MAP_ID` (padrão `DEMO_MAP_ID`) e `isGoogleMapsConfigured`;
  - `STORE_MOCK_LOCATION` e os limites de raio;
  - `normalizeRadius` (múltiplos de 50 m, limitado a 300–10.000) e `formatRadius`.

  Verificar que o frontend compila e, com `npx tsx` importando o arquivo por caminho relativo, que:
  - `normalizeRadius(1230) === 1250`, `normalizeRadius(120) === 300` e `normalizeRadius(12000) === 10000`;
  - `formatRadius(800)`, `formatRadius(1000)` e `formatRadius(2500)` devolvem `"800 m"`, `"1 km"` e `"2,5 km"`.
- [x] 5.3 Criar `data/store.schema.ts` (skill `frontend-form-schema`), com `storeSchema`:
  - `name` (`Name`), `slug` (`Alias`), `phone` opcional (`Phone`) e `address` opcional até 200;
  - `latitude`, `longitude` e `deliveryRadiusMeters` com classes locais que repetem os códigos do domínio, como em `product.schema.ts`;
  - `isActive` e o tipo `StoreFormData`.

  Verificar que o frontend compila e que o schema rejeita `deliveryRadiusMeters: 250` e `latitude: 91` e aceita os dados do "Hub Aldeota".
- [x] 5.4 Criar os hooks:
  - `use-stores.hook.ts`, no padrão de `use-brands.hook.ts`: `page` e `search` na URL, debounce voltando à página 1, página além da última redirecionada, `listQuery` e `remove` com toaster "Loja excluída" e retorno de página;
  - `use-store-form.hook.ts`: criação com raio de 1.000 m e, no modo simulado, com `STORE_MOCK_LOCATION`; edição carregando por id (falha → toaster e volta à lista); envio com opcionais vazios como `null` e `isActive` só na edição; toaster "Loja criada"/"Loja atualizada" e `listHref`; `CONFLICT_FIELD_BY_CODE` para `name`, `slug`, `phone`, `latitude`, `longitude` e `deliveryRadiusMeters`;
  - `use-store-options.hook.ts`, no padrão de `use-brand-options.hook.ts`.

  Atualizar `data/index.ts`. Verificar que `npm run lint --workspace=@jaja/frontend` passa.

## 6. Frontend: telas, localização e menu (subagente Frontend)

- [x] 6.1 Criar `components/store-list.component.tsx` (`TableCard` + `Table`), com:
  - nome e slug, endereço (ou "—"), `formatPhone` (ou "—"), `formatRadius`, badge "Ativa"/"Inativa";
  - editar levando `listQuery` e excluir com `DeleteConfirmationDialog`;
  - `EmptyListState` com estado próprio de busca.

  Criar também `pages/stores.page.tsx` (`StoresPage` e `StoresPageSkeleton`), com o cabeçalho "Lojas" e a contagem, o botão "Nova loja", a busca `role="search"`, `aria-busy` nas recargas e `PaginationControls` com `totalLabel: "lojas"`. Verificar que o frontend compila.
- [x] 6.2 Criar `apps/frontend/public/images/store-map-mock.svg`: uma ilustração vetorial própria, com quadras, ruas e a avenida identificada como "Av. Paulista", um marcador ao centro e o círculo translúcido, nas cores de `DESIGN.md`. Criar também `components/store-location-mock.component.tsx`, conforme o requirement "Mapa simulado sem chave do Google" de `stores/store-admin`:
  - selo "Mapa simulado" e legenda;
  - imagem como botão acessível que aplica `STORE_MOCK_LOCATION`;
  - "Ponto salvo: …" na edição.

  Verificar:
  - o frontend compila;
  - `grep -n "href=\|url(" apps/frontend/public/images/store-map-mock.svg` não encontra referência a imagem externa.
- [x] 6.3 Criar `components/store-location-map.component.tsx` (`'use client'`) conforme a Decisão 9 do `design.md`:
  - `APIProvider` + `Map` com `mapId`;
  - clique no mapa define o ponto, e o `AdvancedMarker` é arrastável;
  - `google.maps.Circle` editável via `useMap()`, com `normalizeRadius`;
  - sincronização com os campos do formulário sem laço;
  - botão "Localizar endereço no mapa", desabilitado com endereço abaixo de 3 caracteres, que chama `geocodeAddress`, mostra `formattedAddress`, avisa quando `source === 'mock'` e mostra toaster em `404`/`503`.

  Verificar que o frontend compila.
- [x] 6.4 Criar `components/store-location-field.component.tsx`:
  - escolhe o mapa do Google quando `isGoogleMapsConfigured` e não houve falha de carregamento;
  - troca para o simulado, com a mensagem, no erro do `APIProvider` ou em `window.gm_authFailure`;
  - sempre exibe os campos `latitude`, `longitude` e `deliveryRadiusMeters` com `FormErrorMessage`, somente leitura no modo simulado.

  Verificar que o frontend compila.
- [x] 6.5 Criar `components/store-form.component.tsx`: página sem modal, com `FormSectionLayout` em `Card` e as seções **Identificação** (`name`, `slug` automático até edição manual, `phone`), **Localização e atendimento** (`address`, `store-location-field` e o texto de apoio do spec) e **Publicação** (`isActive`, só na edição), mais os botões salvar/cancelar. Criar `pages/store-form.page.tsx` (`StoreFormPage({ id, returnQuery })`, com "Nova loja"/"Editar loja", "← Voltar para lojas" e `FormSkeleton`). Verificar que o frontend compila.
- [x] 6.6 Criar `src/app/admin/(shell)/stores/stores/page.tsx` (`StoresPage` em `<Suspense fallback={<StoresPageSkeleton />}>`), `stores/stores/new/page.tsx` (aguarda `searchParams` e repassa `returnQuery`) e `stores/stores/[id]/page.tsx` (aguarda `params`/`searchParams` e renderiza `<StoreFormPage key={id} ... />`), mantendo `(shell)/stores/page.tsx` com o `DashboardPage`. Atualizar `src/modules/stores/index.ts`. Verificar:
  - `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` passam;
  - o build lista `/admin/stores`, `/admin/stores/stores`, `/admin/stores/stores/new` e `/admin/stores/stores/[id]`.
- [x] 6.7 Em `src/shared/navigation/app-modules.ts`, criar para `stores` a seção `stores-overview` ("Visão geral", `STORES_ROUTE`, `match: 'exact'`) e a seção `stores-registrations` com "Lojas" (`id: 'stores-stores'`, ícone `Store`, `STORES_STORES_ROUTE`, `match: 'prefix'`). Em `stores-dashboard.component.tsx`, trocar a `description` do `EmptyDashboardState` pelo aviso de dados de exemplo que aponta para "Lojas". Verificar:
  - `grep -n "API de lojas" apps/frontend/src/modules/stores` não encontra nada;
  - lint e build passam.

## 7. Verificação integrada e fechamento (subagente Frontend)

- [x] 7.1 Com o banco semeado, backend e frontend no ar **sem** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` e sem `GOOGLE_MAPS_API_KEY`, e o painel do navegador visível, entrar como `usuario@formacao.dev` e verificar os cenários de `stores/store-admin`:
  - lista com as 2 lojas, "2,5 km", telefone formatado e "Ativa";
  - busca "aldeota" refletida na URL e `?page=5` indo para a página 1;
  - menu com "Visão geral" e "Lojas", com um único destaque em `/admin/stores` e em `/admin/stores/stores/new`;
  - criação de "Hub Paulista" com o selo "Mapa simulado", salva com o ponto da Avenida Paulista e 1.000 m;
  - raio `250` barrado no cliente e nome "Hub Aldeota" com erro no campo;
  - edição do telefone do "Hub Aldeota" preservando o ponto de Fortaleza;
  - seleção da imagem com Enter aplicando o ponto simulado;
  - desativar o "Hub Cocó" voltando à mesma busca com "Inativa";
  - exclusão com confirmação e toaster;
  - aviso da visão geral apontando para "Lojas".

  Verificado em 13/09/2026, no painel com viewport de 547 px. Diferenças em relação ao roteiro:
  - a criação usou "Hub Paulista Teste", e a desativação e a exclusão foram feitas nessa loja de teste, sem alterar o "Hub Cocó";
  - a seleção da imagem foi confirmada pelo clique do mouse, e não pelo Enter: as ações de teclado da automação chegam com `key` vazio e não acionam botões nativos, e o componente é um `<button>` nativo;
  - o raio `250` não pode ser digitado no modo simulado, porque o campo é somente leitura; a rejeição foi verificada pelo schema na tarefa 5.3.
- [x] 7.2 Se houver chaves do Google disponíveis no ambiente, configurar as duas e verificar os cenários de "Localização no Google Maps": clicar no mapa, arrastar o marcador, redimensionar o círculo (múltiplos de 50 m), editar os campos movendo o mapa e "Localizar endereço no mapa" com `source: "google"`. Com uma chave pública inválida, verificar a mensagem de falha e o mapa simulado. Sem chaves disponíveis, registrar no encerramento que esses cenários não foram verificados.

  Verificado em 13/09/2026 com `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` e `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` configuradas no frontend e **sem** `GOOGLE_MAPS_API_KEY` no backend:
  - o Google Maps carrega no lugar do mapa simulado;
  - clicar no mapa define o ponto;
  - arrastar a alça do círculo muda o raio em múltiplos de 50 m (1000 → 1450);
  - arrastar o marcador move o ponto e o círculo;
  - editar latitude, longitude e raio move o marcador e o círculo, e o raio `250` não altera o círculo;
  - "Localizar endereço no mapa" aplica o ponto simulado com o aviso de busca simulada;
  - a edição abre centrada no ponto salvo.

  Depois, com uma chave própria no backend, restrita à Geocoding API, `GET /geocoding` respondeu:
  - `200` com `source: "google"` para "Avenida Paulista, 1578, São Paulo" e "Rua Silva Paulet, 1100 - Aldeota, Fortaleza/CE";
  - `404` para um endereço inexistente;
  - `400` para `ab`.

  **Não verificados:** o botão "Localizar endereço no mapa" com `source: "google"` na tela e a troca para o mapa simulado com uma chave pública inválida.
- [x] 7.3 Verificar que não houve regressão:
  - `/admin/catalog/brands`, `/admin/catalog/categories` e `/admin/catalog/products` continuam listando e buscando;
  - `/admin/stores` continua exibindo os hubs de exemplo;
  - as telas de clientes, se `cadastro-cliente` já estiver implementada, continuam funcionando com o `withQuery` e o `formatPhone` compartilhados.

## 8. Termo "loja" e remoção dos hubs fictícios (Decisão 13 do `design.md`)

> Substitui a estrutura de menu e rotas das tarefas 6.6 e 6.7 e os nomes "Hub" do seed da tarefa 3.4.

- [x] 8.1 Estruturar o módulo como Clientes:
  - `(shell)/stores/page.tsx` renderiza `StoresPage`; `(shell)/stores/new/page.tsx` e `(shell)/stores/[id]/page.tsx` ficam com o formulário; `(shell)/stores/stores/` é apagada;
  - `stores-routes.ts` com `STORES_ROUTE`, `storesRoute`, `STORE_NEW_ROUTE`, `storeNewRoute` e `storeRoute`;
  - item "Lojas" sem sub-itens em `app-modules.ts`;
  - remoção de `stores-dashboard.component.tsx` e `pages/dashboard.page.tsx`;
  - textos do formulário sem "hub".

  Verificar:
  - o build lista `/admin/stores`, `/admin/stores/new` e `/admin/stores/[id]`, sem `/admin/stores/stores`;
  - `grep -rn "STORES_STORES_ROUTE\|stores-dashboard" apps/frontend/src` não encontra nada.
- [x] 8.2 No admin:
  - tirar o nome de loja fixo do rodapé do menu (`MAIN_HUB`);
  - trocar o texto da tela de acesso para "Acesso restrito à equipe das lojas.";
  - remover do dashboard `/admin` o card mock de área de cobertura e os textos com "hub";
  - apagar `COVERAGE_ROWS`, `COVERAGE_RADIUS_KM` e `MAIN_HUB` de `dashboard.mock.ts`.

  Verificar com `grep -rn "COVERAGE_ROWS\|MAIN_HUB" apps/frontend/src` vazio e com lint e build passando.
- [x] 8.3 Na vitrine, no checkout e no rastreio, trocar "hub" por "loja" nos dados locais, tipos, identificadores e textos, sem mudar o comportamento:
  - `Zone.store` e `storeOf`;
  - lojas "Loja Aldeota" e "Loja Cocó";
  - "Em estoque na …";
  - "a bike já sai da loja";
  - rastreio "Separando na Loja Aldeota".

  Verificar com `grep -rniw -e hub -e hubs -e hubOf apps/frontend/src` vazio e com lint e build passando.
- [x] 8.4 Renomear o seed para "Loja Aldeota" (`loja-aldeota`) e "Loja Cocó" (`loja-coco`) em `stores.json`, os dois registros do banco local por SQL e as referências em `store.integration.http`, `geocoding.integration.http`, nos comentários do model e da entidade e nos testes do domínio. Verificar:
  - `npm test --workspace=@jaja/stores` passa;
  - `grep -rni hub` nos arquivos de lojas do backend, do seed e de `modules/stores` não encontra nada;
  - o seed `--only=stores`, rodado duas vezes, mantém 2 lojas ativas sem slugs `hub-*`;
  - pela API, `search=silva paulet` traz só a "Loja Aldeota", e "LOJA ALDEOTA" e o slug `loja-aldeota` dão `409`.
- [x] 8.5 Verificar no navegador:
  - `/admin/stores` com a lista, o item "Lojas" destacado e sem sub-itens, inclusive em `/admin/stores/new`;
  - `/admin` sem o card de área de cobertura e sem "Hub Aldeota" no rodapé do menu;
  - `/admin/login` com "Acesso restrito à equipe das lojas.";
  - `/?bairro=Papicu` com os bairros agrupados por "Loja Aldeota" e "Loja Cocó";
  - o detalhe de um produto com "… na Loja Aldeota".

> **Ao arquivar esta change:** se `cadastro-cliente` tiver sido arquivada antes, reescrever a delta de `admin/admin-api-authorization` a partir do spec principal atualizado, com a lista combinada da Decisão 11 do `design.md`, antes de rodar o archive.
