> **Execução:** três subagentes separados, cada um com contexto limpo, **nessa ordem**:
> - **Negócio:** grupos 1–2;
> - **Backend:** grupos 3–6;
> - **Frontend:** grupos 7–13.
>
> Um grupo só começa depois de o anterior terminar com as validações passando. O grupo 14 é da conversa principal, com o usuário.
>
> **Antes de começar:** conferir que os prompts 10 e 11 estão implementados (`modules/stores/src/geocoding/provider/geocoding.provider.ts`, `apps/frontend/src/modules/stores/components/store-location-map.component.tsx`, `apps/backend/src/modules/customers/my-customer.controller.ts` e `apps/frontend/src/modules/customers/components/customer-delivery-form.component.tsx`). Se não estiverem, parar e reportar.
>
> **Leitura prévia de cada subagente:**
> - todos: `.claude/skills/skills-standards.md`, o prompt `openspec/extras/prompts/19-minha-conta.md`, o `design.md` e as specs desta change, e as referências de código da sua camada listadas no Contexto do prompt;
> - Frontend, além disso: `apps/frontend/DESIGN.md`.
>
> **Restrições:**
> - não alterar `packages/shared`;
> - não fazer commit nem operações git que mudem o working tree, e não tocar em alterações de outras frentes;
> - não matar backends nem frontends que já estejam rodando: usar outra porta se a ocupada for do usuário;
> - deixar o seed como estava;
> - nunca registrar nem expor `GOOGLE_MAPS_API_KEY` (nem em logs, saídas de comando ou relatórios);
> - não digitar senhas em formulários do navegador: tokens de teste são obtidos por `curl` na API de login.
>
> Cada subagente encerra listando os arquivos criados/alterados e o resultado das validações.

## 1. Ponto do endereço do cliente (subagente Negócio)

- [x] 1.1 Criar `modules/customers/src/customer/model/customer-location.vo.ts` (`CustomerLocation`, `CustomerLocationProps`) com a skill `module-value-object` (Decisão 2):
  - limites −90/90 e −180/180, números finitos, arredondamento para 6 casas e −0 → 0, repetindo as regras do `GeoPoint` sem importar `@jaja/stores`;
  - qualquer valor inválido falha com `CUSTOMER_LOCATION_INVALID` (acrescentado a `CustomerErrors` em `errors.ts`);
  - getters `latitude`/`longitude` e `toDTO()`.

  Exportar em `model/index.ts`. Verificar com `modules/customers/test/customer/customer-location.vo.test.ts`:
  - limites 90/−90 e 180/−180 aceitos;
  - 90,000001 e −180,5 rejeitados;
  - `NaN`, `Infinity`, texto, ausente;
  - arredondamento para 6 casas;
  - −0 vira 0.
- [x] 1.2 Em `dto/customer.dto.ts` (skill `module-dto`), criar `CustomerLocationDTO` (`latitude`, `longitude`) e acrescentar `location: CustomerLocationDTO | null` a `CustomerAddressDTO`. Em `customer-address.vo.ts`:
  - `CustomerAddressProps.location?: CustomerLocationProps | null`;
  - ausente ou `null` → `null`; objeto → `CustomerLocation.tryCreate` dentro do `Result.combine`;
  - `equals` compara também o ponto;
  - comentário: o texto é para o entregador, o ponto é o que as regras de cobertura vão usar.

  Verificar com os casos novos em `customer-address.vo.test.ts`: sem `location` vira `null`; `location` inválido falha com `CUSTOMER_LOCATION_INVALID`; `equals` diferencia endereços iguais com pontos diferentes (e com/sem ponto). Os casos existentes continuam passando.

## 2. Preservação do ponto e contratos de lojas (subagente Negócio)

- [x] 2.1 Em `use-case/save-customer.use-case.ts` (skill `module-use-case`), aplicar a regra de preservação (Decisão 4):
  - criação: `location` ausente ou `null` grava sem ponto;
  - alteração: `undefined` mantém o ponto do cliente existente (mesmo com o texto do endereço mudando), `null` remove, objeto substitui.

  Documentar a regra no JSDoc do caso de uso e em `SaveCustomerInput`. Verificar com os casos novos em `save-customer.use-case.test.ts`:
  - criação com e sem ponto;
  - alteração sem `location` mantém o ponto;
  - alteração com `null` remove;
  - alteração com outro ponto substitui;
  - ponto inválido falha sem chamar `create`/`update` do repositório;
  - alteração pela administração (com `id`) segue a mesma regra.
- [x] 2.2 Em `modules/stores/src/geocoding` (skill `module-dto`):
  - criar `dto/address-suggestion.dto.ts` (`AddressSuggestionDTO`: `latitude`, `longitude`, `formattedAddress`, `zipCode`, `street`, `number`, `neighborhood`, `city`, `state` como `string | null`, `source: 'google' | 'mock'`), com comentário sobre o ponto consultado e os formatos de CEP e UF;
  - acrescentar `GEOCODING_LOCATION_INVALID` a `GeocodingErrors`;
  - acrescentar `reverseGeocode(point)` a `GeocodingProvider` e atualizar o comentário da interface (ok com `null`, `GEOCODING_UNAVAILABLE`, `GEOCODING_LOCATION_INVALID`).

  Exportar nos `index.ts`.
- [x] 2.3 Em `modules/stores/src/store` (skill `module-query-cqrs`), criar `dto/storefront-store.dto.ts` (`StorefrontStoreDTO`) e `provider/find-storefront-stores.query.ts` (`FindStorefrontStoresQuery`, `execute(): Promise<Result<StorefrontStoreDTO[]>>`), com o JSDoc: só ativas e não excluídas, ordem por nome, sem telefone nem datas. Exportar nos `index.ts`.
- [x] 2.4 Rodar `npm test` e `npm run build` nos workspaces `@jaja/customers` e `@jaja/stores`. Verificar que terminam sem erros e que `dist` exporta `CustomerLocation`, `AddressSuggestionDTO`, `FindStorefrontStoresQuery` e `StorefrontStoreDTO`.

## 3. Banco e adapter de clientes (subagente Backend)

- [x] 3.1 Em `apps/backend/prisma/models/customers.model.prisma` (skill `backend-prisma-data`), acrescentar ao `Customer` `latitude Float?` e `longitude Float?`, com o comentário (graus decimais, 6 casas, opcionais e sempre juntas). Rodar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --create-only --name customers_location`, acrescentar à migration `CONSTRAINT customers_location_both_or_none CHECK ((latitude IS NULL) = (longitude IS NULL))` (via `ALTER TABLE ... ADD CONSTRAINT`), aplicar com `npm run prisma:migrate:dev --workspace=@jaja/backend` e rodar `npm run prisma:generate --workspace=@jaja/backend`. Verificar:
  - `\d customers` mostra as duas colunas e a constraint;
  - um `UPDATE customers SET latitude = 1 WHERE id = <id do seed>` falha pela constraint;
  - `SELECT count(*) FROM customers` continua 40 e todos com as duas colunas nulas.
- [x] 3.2 Em `apps/backend/src/modules/customers/customer.prisma.ts`, `toDomain`/`fromDomain` e as queries de detalhe (`findCustomerById`, `findCustomerByUserId`) passam a ler e gravar `address.location` (`null` quando as colunas forem nulas). A listagem não muda. Verificar com `npx tsc --noEmit -p apps/backend`.
- [x] 3.3 Em `customer-http.ts`, `SaveCustomerBody.address.location?: { latitude: number; longitude: number } | null`, e `toInput` repassa o valor **sem** trocar `undefined` por `null` (Decisão 4), com comentário sobre a regra de preservação. Verificar que `PUT /me/customer` e `PUT /customers/:id` usam o mesmo `toInput`.

## 4. Geocodificação reversa (subagente Backend)

- [x] 4.1 Em `google-geocoding.provider.ts`, extrair um método privado com o `fetch` com timeout, o tratamento de status (`ZERO_RESULTS` → ok com `null`) e o log sem a chave, usado por `geocode` e pelo novo `reverseGeocode` (Decisão 5):
  - `latlng=<lat>,<lng>`, `language=pt-BR`, `result_type=street_address|premise|route`;
  - ponto validado por `GeoPoint.tryCreate` (falha `GEOCODING_LOCATION_INVALID`, sem chamar o `fetch`);
  - primeiro resultado mapeado conforme o prompt (`route`, `street_number`, bairro e cidade com fallback, UF de 2 letras, CEP só com 8 dígitos);
  - `latitude`/`longitude` do ponto consultado, arredondadas.

  Verificar com os casos novos em `google-geocoding.provider.spec.ts` (`fetch` simulado):
  - componentes completos;
  - sem número;
  - CEP de 5 dígitos → `null`;
  - `ZERO_RESULTS` → ok com `null`;
  - `REQUEST_DENIED` → `GEOCODING_UNAVAILABLE` sem a chave no log;
  - timeout;
  - ponto inválido sem chamar o `fetch`.

  Os casos existentes do `geocode` continuam passando.
- [x] 4.2 Em `mock-geocoding.provider.ts`, `reverseGeocode` devolve o ponto consultado arredondado com o endereço fixo da Avenida Paulista, 1578 (`zipCode: "01310200"`, `street`, `number`, `neighborhood: "Bela Vista"`, `city: "São Paulo"`, `state: "SP"`, o mesmo `formattedAddress` do `geocode` e `source: "mock"`). Ponto inválido → `GEOCODING_LOCATION_INVALID`. Verificar com `mock-geocoding.provider.spec.ts`: ponto devolvido arredondado; ponto inválido.
- [x] 4.3 Em `geocoding.controller.ts` (skill `backend-controller`), trocar `@AdminOnly()` por `@UseGuards(JwtGuard)` (Decisão 6) e criar o método `reverse` (`GET /geocoding/reverse`):
  - ausente, vazio ou não numérico → `400 [GEOCODING_LOCATION_INVALID]` sem chamar o provedor;
  - falha `GEOCODING_LOCATION_INVALID` do provedor → `400`, outras falhas → `503 [GEOCODING_UNAVAILABLE]`;
  - `null` → `404 [GEOCODING_ADDRESS_NOT_FOUND]`;
  - `200` com o `AddressSuggestionDTO`.

  `GET /geocoding` não muda de contrato. Verificar com `npx tsc --noEmit -p apps/backend`.

## 5. Lojas da vitrine (subagente Backend)

- [x] 5.1 Em `store.prisma.ts`, implementar `findStorefrontStores` como atributo público (Decisão 7): `SELECT` explícito dos campos do DTO, `is_active AND deleted_at IS NULL`, `NAME_ORDER`. Criar `apps/backend/src/modules/stores/storefront-store.controller.ts` (`StorefrontStoreController`, `@Controller('storefront/stores')`, sem guard, com o comentário do `StorefrontController`) com `GET /storefront/stores` chamando a query direto, e registrar em `stores.module.ts`. Verificar com `npx tsc --noEmit -p apps/backend`.

## 6. Integração e validação do backend (subagente Backend)

- [x] 6.1 Rodar `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend`. Verificar que terminam sem erros, com os specs existentes passando.
- [x] 6.2 Atualizar os `.http`:
  - `customers/test/customer.integration.http`, em `/me/customer`:
    - gravar com ponto (200, `location` arredondado);
    - novo `PUT` sem `location` mantém o ponto;
    - `location: null` remove;
    - `latitude: 91` → 400 `CUSTOMER_LOCATION_INVALID`;
    - e, em `/customers`, alteração pelo administrador sem `location` mantém o ponto;
  - `stores/test/geocoding.integration.http`: usuário não administrador recebe `200` em `GET /geocoding`; `GET /geocoding/reverse` sem token (401), com usuário comum (200), sem `longitude` (400), `latitude=abc` (400) e `latitude=95` (400);
  - `stores/test/storefront-store.integration.http` (novo): sem token → 200 com as duas lojas do seed, sem `phone`, `isActive` nem datas.

  Subir um backend próprio numa porta livre (`npm run dev --workspace=@jaja/backend`, 4000 se livre) **sem** `GOOGLE_MAPS_API_KEY` e executar os três `.http` por `curl`. Verificar que todos respondem como descrito (respostas `mock`) e que `order.integration.http` continua passando. Se a chave estiver no `.env`, repetir `GET /geocoding` e `GET /geocoding/reverse` com ela (`source: "google"`), sem imprimir a chave.
- [x] 6.3 Deixar os dados como estavam: devolver ao cliente usado nos `.http` os valores originais (inclusive `location: null`) e confirmar `SELECT count(*) FROM customers WHERE latitude IS NOT NULL` = 0.

## 7. Infra do mapa compartilhada (subagente Frontend)

- [x] 7.1 Criar `apps/frontend/src/shared/maps/google-maps.config.ts` com `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_MAP_ID`, `isGoogleMapsConfigured`, `COORDINATE_DECIMALS` e `roundCoordinate` (movidos de `modules/stores/data/store-location.util.ts`), e `use-google-maps-load-failure.hook.ts` (`loadFailed`, `handleLoadError`, `gm_authFailure` encadeado e restaurado), extraído de `store-location-field.component.tsx` (Decisão 8). Ajustar os imports de `store-location-field`, `store-location-map`, `store-location-mock` e `modules/stores/index.ts`. Verificar com `npm run lint --workspace=@jaja/frontend` e `grep -rn "STORE_COORDINATE_DECIMALS\|gm_authFailure" apps/frontend/src` (só no hook novo).

## 8. Dados do frontend (subagente Frontend)

- [x] 8.1 Em `modules/stores/data`:
  - `geocoding.api.ts`: tipo `AddressSuggestion` e `reverseGeocode(token, { latitude, longitude })`; comentário do arquivo sem "só administradores";
  - `storefront-store.api.ts` (`StorefrontStore`, `listStorefrontStores()` sem token);
  - `use-storefront-stores.hook.ts` (`useStorefrontStores()`: carrega uma vez; `stores`, `loading`, `findBySlug`; erro → `toast.error` e lista vazia).

  Atualizar `data/index.ts`. Verificar com `npm run lint --workspace=@jaja/frontend`.
- [x] 8.2 Em `modules/catalog/data`, acrescentar `storeSlug` ao tipo `Zone` e às lojas de `ZONES` (`loja-paulista`, `loja-rio-branco`, citando o seed no comentário), e expor `storeSlug` em `useStorefront()`. Verificar com `npm run lint --workspace=@jaja/frontend`.
- [x] 8.3 Em `modules/customers/data`:
  - `customer.api.ts`: `CustomerLocation` e `location: CustomerLocation | null` em `CustomerAddress`; `CustomerInput.address.location?: CustomerLocation | null`;
  - `customer.schema.ts`: `address.location` opcional (`{ latitude, longitude }` nos limites, ou `null`);
  - `customer-form.util.ts`: `toCustomerFormValues` leva o ponto; `toCustomerInput` o envia como está; `emptyCustomerFormValues` sem `location`; `CUSTOMER_LOCATION_INVALID` fora do mapa de campos (erro geral);
  - `customer-address.util.ts` (ou `customer.util.ts`): `applyAddressSuggestion(current, suggestion)` e `addressSearchText(address)`;
  - `use-my-account-form.hook.ts` (`useMyAccountForm({ customer, defaults, save })`, Decisão 10).

  Atualizar `data/index.ts`. Verificar com `npm run lint --workspace=@jaja/frontend` e conferindo, por leitura, que `use-customer-form.hook.ts` e `use-customer-delivery-form.hook.ts` passam a devolver o ponto recebido.
- [x] 8.4 Acrescentar `CUSTOMER_LOCATION_INVALID` e `GEOCODING_LOCATION_INVALID` ("Ponto do mapa inválido.") a `messages.pt.ts` e `messages.en.ts`, em ordem alfabética. Verificar com `grep`.

## 9. Mapa e formulário de Minha conta (subagente Frontend)

- [x] 9.1 Criar `modules/customers/components/customer-address-map.component.tsx` (`CustomerAddressMap`), conforme a spec `customers/my-account` e a Decisão 9:
  - câmera inicial;
  - marcadores da loja e do cliente;
  - clique e fim do arraste com sugestão e descarte de resposta atrasada;
  - cartão de sugestão (`role="status"`) com "Usar este endereço" e "Dispensar";
  - "Localizar endereço no mapa";
  - aviso de ponto desatualizado;
  - "Remover ponto";
  - texto de apoio;
  - mapa simulado com "Usar ponto de exemplo" e aviso de chave recusada.

  Verificar com `npm run lint --workspace=@jaja/frontend`.
- [x] 9.2 Criar `modules/customers/components/my-account-form.component.tsx` com os cartões "Dados pessoais" e "Endereço de entrega" e o rodapé "Salvar dados"/"Descartar alterações", no visual da loja (checkout). Verificar com `npm run lint --workspace=@jaja/frontend`.

## 10. Página, rota e menu (subagente Frontend)

- [x] 10.1 Criar `modules/customers/pages/my-account.page.tsx` (`MyAccountPage`): container de 1080px, título "Minha conta", estados sem sessão ("Entre para ver sua conta" com `AuthForm`), carregando (cartões estáticos), sem cadastro (apoio e padrões da vitrine) e com cadastro; centro do mapa por `useStorefront().storeSlug` + `useStorefrontStores().findBySlug`. Criar a rota `src/app/(public)/minha-conta/page.tsx` com `<Suspense>` e, em `storefront-routes.ts`, `MY_ACCOUNT_ROUTE` e `myAccountRoute(query?)` com `withQuery`. Verificar que a página usa o cabeçalho completo e com `npm run lint --workspace=@jaja/frontend`.
- [x] 10.2 Em `storefront-header.component.tsx` (`AccountControl`), acrescentar "Minha conta" (`UserRound`) antes de "Área administrativa" para todo usuário logado, com `myAccountRoute(storefront.query)`, e trocar "Conta do escritório" pelo email do usuário (administradores continuam "Administrador"), passando o que faltar a partir de `storefront-shell.component.tsx`. Verificar com `npm run lint --workspace=@jaja/frontend`.

## 11. Documentação e validação do frontend (subagente Frontend)

- [x] 11.1 Atualizar `apps/frontend/DESIGN.md` com a seção "Minha conta (`/minha-conta`)" e o item no menu da conta, e os `index.ts` dos módulos `customers` e `stores`. Verificar lendo a seção.
- [x] 11.2 Rodar `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend`. Verificar que terminam sem erros.
- [x] 11.3 Validar no navegador **sem** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, com a sessão injetada a partir de um token obtido por `curl` (sem digitar senha):
  - usuário comum sem cliente em `/?bairro=Bela Vista`: menu → "Minha conta" com a query; mapa simulado; "Usar ponto de exemplo" marca a Loja Paulista; sugestão `mock`; "Usar este endereço" preenche os campos; CPF e telefone; "Salvar dados"; recarregar mantém o ponto (`GET /me/customer`);
  - `/minha-conta?bairro=Centro`: o ponto de exemplo é o da Loja Rio Branco;
  - mudar o número depois do ponto mostra o aviso de ponto desatualizado; "Remover ponto" e salvar → `location: null`;
  - checkout do mesmo usuário: "Alterar" e salvar sem mudar o ponto; admin: editar o cliente e salvar sem mudar o ponto (conferir em `GET /me/customer`);
  - sair em "Minha conta" volta ao formulário de acesso na mesma URL;
  - 375px sem rolagem horizontal;
  - `/admin/stores/new` continua com o mapa simulado e "Localizar endereço no mapa" funcionando.

  Registrar capturas. Ao final, devolver o usuário de teste ao estado inicial (sem cliente, se não tinha) e o cliente editado aos valores originais.

## 12. Todas as lojas no mapa, com o raio de atendimento (subagente Frontend)

- [x] 12.1 Em `modules/customers/components/customer-address-map.component.tsx`, passar a receber todas as lojas ativas e a loja selecionada (em vez de só a selecionada) e desenhar, conforme a spec `customers/my-account` e a Decisão 11:
  - marcador fixo de cada loja, com nome e raio no título, e destaque visual para a selecionada;
  - círculo `google.maps.Circle` read-only por loja, com o `deliveryRadiusMeters` dela, no padrão imperativo de `store-location-map.component.tsx` (sem `editable`/`draggable`), removidos no unmount;
  - clique no marcador ou no círculo de uma loja marca o ponto do cliente ali, com o mesmo fluxo de sugestão do clique no mapa;
  - lista das lojas com nome e raio (`formatRadius`) abaixo do mapa, com a selecionada indicada, exibida também no mapa simulado.

  Ajustar `my-account-form.component.tsx` e `my-account.page.tsx` para repassar a lista de `useStorefrontStores()` e o `storeSlug` da vitrine. Nada é bloqueado pela posição do ponto. Verificar com `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend`.
- [x] 12.2 Validar no navegador (sem `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, como na tarefa 11.3, e também com a chave se disponível):
  - `/minha-conta?bairro=Bela Vista`: marcadores e círculos das duas lojas do seed, "Loja Paulista" em destaque, e a lista com os dois raios;
  - clicar no círculo da loja marca o ponto e pede a sugestão;
  - ponto fora de todos os raios salva sem aviso;
  - mapa simulado exibe a lista das lojas;
  - 375px sem rolagem horizontal.

  Devolver os dados de teste ao estado inicial ao final.

## 13. Navegar até as outras lojas no mapa (subagente Frontend)

- [x] 13.1 Em `customer-address-map.component.tsx`, acrescentar à lista de lojas, conforme a spec `customers/my-account` e a Decisão 11: o endereço de referência de cada loja; a ação "Ver no mapa" por loja (câmera na loja com zoom de bairro); e "Ver todas as lojas" (`fitBounds` com todas as lojas e o ponto do cliente, quando houver). Nenhuma das ações grava, move ou apaga o ponto, nem pede sugestão. No mapa simulado as ações não aparecem. Verificar com `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend`, e no navegador: "Ver no mapa" na Loja Rio Branco a partir de `?bairro=Bela Vista` mostra o marcador e o círculo dela; "Ver todas as lojas" mostra as duas; o ponto do cliente não muda em nenhuma das duas.

## 14. Conferência com o Google Maps real (conversa principal, com o usuário)

- [ ] 14.1 **Não conferido: arquivado a pedido do usuário sem esta conferência.** Com `GOOGLE_MAPS_API_KEY` no backend e `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no frontend, o usuário faz login e confere:
  - usuário sem cadastro a partir de `/?bairro=Bela Vista`: mapa centrado na Loja Paulista, marcar um ponto próximo, sugestão do Google, "Usar este endereço", CPF e telefone, salvar e recarregar mantendo o ponto;
  - a partir de `/?bairro=Centro`: mapa centrado na Loja Rio Branco;
  - usuário com cadastro do seed (Fortaleza, sem ponto): digitar outro endereço, "Localizar endereço no mapa", salvar; depois mudar o número e ver o aviso de ponto desatualizado;
  - arrastar o marcador pede uma nova sugestão só ao soltar;
  - o cadastro de loja no admin continua com o mapa real;
  - chave pública inválida: mapa simulado com o aviso de falha.
