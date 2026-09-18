# Contexto do projeto (ler antes de executar)

- Namespace do monorepo: `@jaja`. Pacotes de domínio: `modules/customers` (`@jaja/customers`, agregado `customer`, prompt 11) e `modules/stores` (`@jaja/stores`, agregado `store` e `geocoding`, prompt 10). Backend: `apps/backend` (NestJS 12, ESM com imports relativos terminando em `.js`, Vitest). Frontend: `apps/frontend` (Next.js 16, React 19, React Compiler). Shared: `@mentoria-360/shared` (submódulo em `packages/shared`). Skills em `.claude/skills/*`; padrão de nomes em `.claude/skills/skills-standards.md`.
- **Pré-requisitos: prompts 10 (`cadastro-loja`), 11 (`cadastro-cliente`) e 15 a 18 já implementados.** O que já existe:
  - o cliente (`customer`) é 1:1 com o usuário e tem CPF, telefone e **um** endereço estruturado (`CustomerAddress`: CEP, logradouro, número, complemento, bairro, cidade e UF), sem coordenadas. `GET /me/customer` e `PUT /me/customer` leem e gravam o cadastro do usuário do token; o `PUT` cria ou altera pelo `SaveCustomer`, que substitui o endereço inteiro;
  - hoje o usuário só vê e altera esses dados no passo 1 do checkout (`CustomerDeliveryForm` e `CustomerDeliverySummary`, em `modules/customers/components`), sem mapa;
  - a loja (`store`) é um ponto no mapa (`latitude`/`longitude`, 6 casas) com raio de atendimento. O seed tem duas lojas: "Loja Paulista" (`loja-paulista`, São Paulo/SP) e "Loja Rio Branco" (`loja-rio-branco`, Rio de Janeiro/RJ). A API de lojas (`/stores`) é só administrativa;
  - `GET /geocoding?address=` (só administradores) localiza as coordenadas de um endereço em texto livre pelo `GeocodingProvider`: `GoogleGeocodingProvider` com `GOOGLE_MAPS_API_KEY` no backend, ou `MockGeocodingProvider` (ponto fixo da Avenida Paulista, 1578) sem a chave;
  - o formulário de loja usa o Google Maps pelo `@vis.gl/react-google-maps` com `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, e cai no mapa simulado (`store-location-mock.component.tsx`) sem a chave pública ou quando o Google recusa a chave (`window.gm_authFailure`);
  - na vitrine, a loja selecionada é derivada do bairro (`?bairro=`) pelo mock `ZONES` (`modules/catalog/data/storefront.mock.ts`), exposta por `useStorefront()` como `store` (nome), `city` e `state`;
  - o menu da conta no cabeçalho da loja (`AccountControl` em `src/shared/components/store/storefront-header.component.tsx`) tem só o nome, "Área administrativa" (administradores) e "Sair".
- **Objetivo:** dar ao usuário logado uma página **"Minha conta"**, aberta pelo menu da conta na loja, com os **dados pessoais** e o **endereço de entrega**. O endereço pode ser informado de dois jeitos, que se complementam:
  - **tradicional:** digitando os campos (os mesmos do checkout), com a opção de localizar no mapa o endereço digitado;
  - **pelo mapa:** o mapa abre centrado na loja selecionada na vitrine; o usuário marca o ponto (clique ou arrastando o marcador), e o sistema **sugere** o endereço daquele ponto (geocodificação reversa). O usuário decide se usa a sugestão, que preenche os campos, e confere o número e o complemento.
- **Por que guardar o ponto:** o endereço em texto é para o entregador; o **ponto** (latitude e longitude) é o que permitirá, nos próximos prompts, dizer se o usuário pode pedir (dentro do raio de alguma loja) e sugerir a loja que atende o endereço. Nesta entrega o ponto só é **gravado** no cadastro do cliente; nenhuma regra o usa ainda.
- **Decisões:**
  - **Ponto opcional:** o cliente pode ter endereço sem ponto (cadastros existentes, checkout e administração continuam sem mapa). Latitude e longitude andam juntas: as duas ou nenhuma.
  - **Ponto preservado quando não enviado:** no `SaveCustomer`, `location` ausente (`undefined`) mantém o ponto atual; `null` remove; um objeto grava. Assim o checkout e a edição administrativa, que não mostram o mapa, não apagam o ponto marcado em "Minha conta".
  - **A sugestão nunca sobrescreve sozinha:** marcar o ponto grava só o ponto; os campos só mudam quando o usuário clica em "Usar este endereço".
  - **Coordenadas do usuário são as do ponto marcado**, não as do resultado do provedor: a sugestão devolve o endereço mais próximo, mas o marcador fica onde o usuário o colocou.
  - **Geocodificação para qualquer usuário autenticado:** `GET /geocoding` e o novo `GET /geocoding/reverse` deixam de ser só administrativos e passam a exigir apenas um token válido. A chave do Google continua só no servidor.
  - **Lojas na vitrine por endpoint público:** a página precisa das coordenadas da loja selecionada. Criar uma leitura pública, sem dados administrativos, e casar a loja do mock `ZONES` pelo **slug**.
- **Referências de código** (o código é a fonte da verdade do **padrão**; este prompt é a fonte da verdade das **regras**):
  - domínio:
    - clientes: `modules/customers/src/customer/**` (`model/customer-address.vo.ts`, `model/customer.entity.ts`, `use-case/save-customer.use-case.ts`, `errors.ts`) e `modules/customers/test/**`;
    - lojas: `modules/stores/src/store/model/geo-point.vo.ts` (arredondamento e limites das coordenadas), `modules/stores/src/geocoding/**`, `modules/stores/src/store/provider/find-stores.query.ts`;
  - backend:
    - clientes: `apps/backend/src/modules/customers/` (`customer.prisma.ts`, `my-customer.controller.ts`, `customer-http.ts`, `test/customer.integration.http`) e `apps/backend/prisma/models/customers.model.prisma`;
    - lojas e geocodificação: `apps/backend/src/modules/stores/` (`geocoding.controller.ts`, `google-geocoding.provider.ts` e `.spec.ts`, `mock-geocoding.provider.ts` e `.spec.ts`, `store.prisma.ts`, `stores.module.ts`, `test/geocoding.integration.http`);
    - leitura pública da vitrine: `apps/backend/src/modules/catalog/storefront.controller.ts`;
  - frontend:
    - clientes: `modules/customers/data/` (`customer.api.ts`, `customer.schema.ts`, `customer-form.util.ts`, `use-my-customer.hook.ts`, `use-customer-delivery-form.hook.ts`) e `modules/customers/components/` (`customer-delivery-form.component.tsx`, `customer-address-fields.component.tsx`);
    - mapa: `modules/stores/components/store-location-field.component.tsx`, `store-location-map.component.tsx`, `store-location-mock.component.tsx` e `modules/stores/data/store-location.util.ts`, `geocoding.api.ts`;
    - loja: `modules/catalog/components/storefront-shell.component.tsx`, `modules/catalog/data/use-storefront.hook.ts`, `storefront.mock.ts`, `src/shared/components/store/storefront-header.component.tsx`, `modules/orders/pages/checkout.page.tsx` (`CheckoutGate` com o `AuthForm` na mesma URL) e `src/shared/navigation/storefront-routes.ts`;
    - design: `apps/frontend/DESIGN.md` ("Checkout" e "Regras").
- `@jaja/customers` e `@jaja/stores` são consumidos via `dist`: rodar `npm run build --workspace=@jaja/customers` e `npm run build --workspace=@jaja/stores` antes de usá-los no backend. O pacote `@jaja/customers` **não importa** `@jaja/stores`. Os testes dos pacotes de domínio usam jest; os do backend, Vitest. O frontend não importa pacotes `@jaja/*`.
- Spec desta funcionalidade: change `openspec/changes/minha-conta`, gerada a partir deste prompt. Em caso de dúvida sobre comportamento, valem as specs e o `design.md` da change.
- **Fora do escopo desta funcionalidade:**
  - validar se o ponto do cliente está dentro do raio de alguma loja, bloquear pedidos por isso e sugerir a loja que atende o endereço (próximos prompts);
  - copiar o ponto para o endereço do pedido (`orders`);
  - mapa no checkout e na edição administrativa de clientes (continuam só com os campos);
  - alterar nome, email ou senha do usuário (continuam do `auth`, só exibidos);
  - vários endereços por cliente, "Meus pedidos", localização atual pelo navegador (`navigator.geolocation`), preenchimento pelo CEP (ViaCEP) e autocomplete de endereço do Google (Places);
  - limite de chamadas à geocodificação por usuário;
  - trocar a vitrine de bairros simulados (`ZONES`) por lojas reais;
  - pontos (latitude e longitude) no seed de clientes: os 40 clientes do seed continuam sem ponto;
  - alterações em `packages/shared`.

# Negócio

- **Ponto do endereço do cliente** (skill: module-value-object):
  - Criar `modules/customers/src/customer/model/customer-location.vo.ts` (`CustomerLocation`, VO composto): `latitude` de −90 a 90 e `longitude` de −180 a 180, números finitos, arredondados para 6 casas (−0 vira 0), com as mesmas regras do `GeoPoint` de `@jaja/stores` (repetidas aqui, sem importar o pacote de lojas). Qualquer valor inválido falha com `CUSTOMER_LOCATION_INVALID`, acrescentado a `CustomerErrors`. Getters e `toDTO()`.
  - Em `dto/customer.dto.ts`, criar `CustomerLocationDTO` (`latitude`, `longitude`) e acrescentar `location: CustomerLocationDTO | null` a `CustomerAddressDTO`.
  - Em `CustomerAddress`, aceitar `location?: CustomerLocationProps | null`: ausente ou `null` vira `null`; um objeto é validado por `CustomerLocation.tryCreate` e entra no `Result.combine`. `equals` passa a comparar também o ponto. Comentar no VO que o texto do endereço é para o entregador e o ponto é o que as regras de cobertura vão usar.
- **`SaveCustomer`** (skill: module-use-case): a entrada `address.location` segue a regra de preservação:
  - na **criação**, ausente ou `null` grava sem ponto;
  - na **alteração**, `undefined` mantém o ponto atual do cliente (mesmo que o restante do endereço mude), `null` remove e um objeto substitui.

  Documentar a regra no JSDoc do caso de uso e em `SaveCustomerInput`. As demais regras do prompt 11 não mudam.
- **Sugestão de endereço por um ponto** (em `modules/stores/src/geocoding`, skill: module-dto):
  - Criar `dto/address-suggestion.dto.ts` com `AddressSuggestionDTO`:
    - `latitude` e `longitude`: o ponto **consultado**, arredondado para 6 casas (não o do resultado do provedor);
    - `formattedAddress`: o endereço completo devolvido pelo provedor;
    - `zipCode` (só 8 dígitos), `street`, `number`, `neighborhood`, `city` e `state` (UF em maiúsculas, 2 letras): cada um `string | null`, `null` quando o provedor não trouxer o componente ou ele não estiver no formato;
    - `source: 'google' | 'mock'`.
  - Acrescentar a `GeocodingProvider` o método `reverseGeocode(point: { latitude: number; longitude: number }): Promise<Result<AddressSuggestionDTO | null>>`: ok com `null` quando não há endereço para o ponto; falha com `GEOCODING_UNAVAILABLE` quando o serviço não responde; falha com `GEOCODING_LOCATION_INVALID` (novo código em `GeocodingErrors`) quando o ponto não passa por `GeoPoint.tryCreate`. Atualizar o comentário da interface.
- Criar testes unitários (jest):
  - `modules/customers/test/customer/customer-location.vo.test.ts`: limites (90/−90, 180/−180), fora do limite, `NaN`/`Infinity`/texto, arredondamento para 6 casas e −0;
  - em `customer-address.vo.test.ts`: sem `location` vira `null`, `location` inválido falha com `CUSTOMER_LOCATION_INVALID`, `equals` considerando o ponto;
  - em `save-customer.use-case.test.ts`: criação com e sem ponto; alteração sem `location` mantém o ponto; alteração com `null` remove; alteração com outro ponto substitui; ponto inválido falha sem gravar.

  Rodar `npm test` e `npm run build` nos workspaces `@jaja/customers` e `@jaja/stores`.

> Os passos dos casos de uso podem gerar erros e parar o processo.

# Backend

- **Prisma** (skill: backend-prisma-data): em `customers.model.prisma`, acrescentar ao model `Customer` `latitude Float?` e `longitude Float?` (colunas `latitude` e `longitude`), com o comentário de que são graus decimais com 6 casas, opcionais e sempre juntas. Executar `npm run prisma:migrate:dev --workspace=@jaja/backend -- --create-only --name customers_location`, acrescentar à migration gerada a constraint `customers_location_both_or_none CHECK ((latitude IS NULL) = (longitude IS NULL))`, aplicar com `npm run prisma:migrate:dev --workspace=@jaja/backend` e rodar `npm run prisma:generate --workspace=@jaja/backend`.
- **Clientes:**
  - `customer.prisma.ts`: `toDomain`/`fromDomain` e as queries de detalhe (`findCustomerById`, `findCustomerByUserId`) passam a ler e gravar `address.location` (`null` quando as colunas forem nulas). A listagem não muda.
  - `customer-http.ts`: `SaveCustomerBody.address` ganha `location?: { latitude: number; longitude: number } | null`, e `toInput` repassa o valor **sem trocar `undefined` por `null`** (a diferença entre ausente e `null` é a regra de preservação). O `PUT /customers/:id` do administrador segue a mesma regra.
  - `test/customer.integration.http`: acrescentar em `/me/customer`: gravar com ponto (200, `location` arredondado); novo `PUT` sem `location` mantém o ponto; `location: null` remove; ponto inválido (`latitude: 91`) → 400 `CUSTOMER_LOCATION_INVALID`; e, em `/customers`, alteração pelo administrador sem `location` mantém o ponto do cliente.
- **Geocodificação reversa:**
  - `GoogleGeocodingProvider.reverseGeocode`: mesma URL da Geocoding API com `latlng=<lat>,<lng>`, `language=pt-BR`, `result_type=street_address|premise|route` e o mesmo timeout, tratamento de status, log sem a chave e `ZERO_RESULTS` → ok com `null`. Usar o primeiro resultado e mapear `address_components`:
    - `route` → `street`;
    - `street_number` → `number`;
    - `sublocality_level_1`, depois `sublocality`, depois `neighborhood` → `neighborhood`;
    - `administrative_area_level_2`, depois `locality` → `city`;
    - `short_name` de `administrative_area_level_1` com 2 letras → `state`;
    - `postal_code` só com 8 dígitos (sem traço) → `zipCode`; CEP incompleto (5 dígitos) vira `null`.

    Extrair o `fetch` com timeout e o tratamento de status compartilhados por `geocode` e `reverseGeocode` para um método privado, sem duplicar.
  - `MockGeocodingProvider.reverseGeocode`: sem chamar serviço externo, devolve o ponto consultado com o endereço fixo da Avenida Paulista, 1578 (`zipCode: "01310200"`, `street: "Avenida Paulista"`, `number: "1578"`, `neighborhood: "Bela Vista"`, `city: "São Paulo"`, `state: "SP"`, o mesmo `formattedAddress` do `geocode` e `source: "mock"`). Ponto inválido falha com `GEOCODING_LOCATION_INVALID`.
  - Testes Vitest em `google-geocoding.provider.spec.ts` (com `fetch` simulado: componentes completos, sem número, CEP de 5 dígitos, `ZERO_RESULTS`, `REQUEST_DENIED` sem a chave no log, timeout) e `mock-geocoding.provider.spec.ts` (ponto consultado devolvido arredondado, ponto inválido).
- **`GeocodingController`** (skill: backend-controller):
  - trocar `@AdminOnly()` da classe por `@UseGuards(JwtGuard)`: qualquer usuário autenticado; `401` sem token, com token expirado ou adulterado, sem consultar o provedor;
  - `GET /geocoding` não muda de contrato;
  - novo `GET /geocoding/reverse?latitude=&longitude=`: os dois parâmetros convertidos para número (ausente, vazio ou não numérico → `400 [GEOCODING_LOCATION_INVALID]`, sem consultar o provedor); `200` com o `AddressSuggestionDTO`; `null` → `404 [GEOCODING_ADDRESS_NOT_FOUND]`; falha de indisponibilidade → `503 [GEOCODING_UNAVAILABLE]`; a falha `GEOCODING_LOCATION_INVALID` do provedor → `400`. Declarar a rota `reverse` como método próprio do controller.
  - `test/geocoding.integration.http`: o usuário não administrador passa a receber `200` em `GET /geocoding`; acrescentar `GET /geocoding/reverse` sem token (401), com usuário comum (200), sem `longitude` (400), `latitude=abc` (400) e `latitude=95` (400).
- **Lojas da vitrine** (skill: module-query-cqrs):
  - em `modules/stores/src/store`, criar `dto/storefront-store.dto.ts` (`StorefrontStoreDTO`: `id`, `name`, `slug`, `address` (texto de referência ou `null`), `latitude`, `longitude` e `deliveryRadiusMeters`) e a interface `provider/find-storefront-stores.query.ts` (`FindStorefrontStoresQuery`, `execute(): Promise<Result<StorefrontStoreDTO[]>>`): só lojas ativas e não excluídas, ordenadas por nome (`COLLATE "pt-BR-x-icu"`), sem telefone nem datas;
  - implementar em `StorePrisma` como atributo público `findStorefrontStores`;
  - criar `apps/backend/src/modules/stores/storefront-store.controller.ts` (`StorefrontStoreController`, `@Controller('storefront/stores')`, **público**, como o `StorefrontController` do catálogo) com `GET /storefront/stores` chamando a query diretamente; registrar em `stores.module.ts`;
  - `test/storefront-store.integration.http`: sem token (200 com as duas lojas do seed), conferindo que a resposta não traz `phone`, `isActive` nem datas.
- Subir o backend (`npm run dev --workspace=@jaja/backend`, porta 4000) e validar os três `.http`, **sem** `GOOGLE_MAPS_API_KEY` (respostas `mock`) e, se a chave estiver disponível no `.env`, também com ela.
- Validação: `npm run test --workspace=@jaja/backend`, `npm run lint --workspace=@jaja/backend` e `npm run build --workspace=@jaja/backend` sem erros.

# Frontend

- **Mapa compartilhado:** extrair de `modules/stores/data/store-location.util.ts` para `src/shared/maps/google-maps.config.ts` o que não é da loja (`GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_MAP_ID`, `isGoogleMapsConfigured`, `COORDINATE_DECIMALS` e `roundCoordinate`) e, de `store-location-field.component.tsx`, a detecção de chave recusada para o hook `src/shared/maps/use-google-maps-load-failure.hook.ts` (devolve `loadFailed` e `handleLoadError`, com o `window.gm_authFailure` encadeado ao anterior). Ajustar os imports do cadastro de loja, sem mudar o comportamento dele.
- **Mensagens:** `CUSTOMER_LOCATION_INVALID` ("Ponto do mapa inválido.") e `GEOCODING_LOCATION_INVALID` ("Ponto do mapa inválido.") em `messages.pt.ts` e `messages.en.ts`, na ordem alfabética das chaves. `GEOCODING_ADDRESS_NOT_FOUND` ("Endereço não encontrado.") não muda: o mapa do cliente exibe um texto próprio para o ponto sem endereço.
- **Dados** (arquivos flat em `data/`):
  - `modules/stores/data/geocoding.api.ts`: tipo `AddressSuggestion` e `reverseGeocode(token, { latitude, longitude })`; atualizar o comentário do arquivo (não é mais só para administradores).
  - `modules/stores/data/storefront-store.api.ts` (`StorefrontStore`, `listStorefrontStores()` sem token) e `use-storefront-stores.hook.ts` (`useStorefrontStores()`: carrega uma vez e expõe `stores`, `loading` e `findBySlug(slug)`; erro vira `toast.error` e lista vazia).
  - `modules/catalog/data/storefront.mock.ts`: acrescentar `storeSlug` às lojas do `ZONES` (`loja-paulista` e `loja-rio-branco`), e `useStorefront()` passa a expor `storeSlug`.
  - `modules/customers/data/customer.api.ts`: `CustomerLocation` e `location: CustomerLocation | null` em `CustomerAddress`; o `address.location` do `CustomerInput` é opcional e aceita `null`.
  - `customer.schema.ts`: `address.location` opcional (`{ latitude, longitude }` nos limites do domínio, ou `null`). `customer-form.util.ts`: `toCustomerFormValues` leva o ponto do cadastro, e `toCustomerInput` o envia como está. Assim o checkout e a edição administrativa devolvem o ponto que receberam, sem editá-lo.
  - `customer-address.util.ts` (ou em `customer.util.ts`, se ficar curto): `applyAddressSuggestion(current, suggestion)` devolve os campos do endereço com os componentes **não nulos** da sugestão (CEP formatado), mantendo `complement` e os campos que vieram `null`; e `addressSearchText(address)` monta o texto para `GET /geocoding` (logradouro, número, bairro, cidade/UF e CEP, sem complemento).
  - `use-my-account-form.hook.ts`: `useMyAccountForm({ customer, defaults, save })`, no padrão de `use-customer-delivery-form.hook.ts` (mesmo schema, mesmo `reportCustomerSaveError`, `CUSTOMER_LOCATION_INVALID` como erro geral acima do mapa), com o toaster "Dados salvos". Depois de salvar, faz `reset` com os valores salvos (o formulário deixa de estar alterado).
- **Componentes** em `modules/customers/components`:
  - `customer-address-map.component.tsx` (`CustomerAddressMap`), editor do `address.location` do formulário, no padrão de `store-location-map.component.tsx`:
    - **câmera inicial:** o ponto do cliente com zoom de rua; sem ponto, a loja selecionada na vitrine (`center` recebido por prop) com zoom de bairro e, sem loja, o ponto simulado da Avenida Paulista;
    - **marcadores:** o da loja selecionada, sem arrastar, com o nome como título e visual diferente do marcador do cliente; o do cliente, arrastável, só quando há ponto;
    - **marcar o ponto:** clique no mapa ou fim do arraste gravam `address.location` (6 casas, `shouldDirty`) e pedem a sugestão com `reverseGeocode`. A sugestão é pedida só no clique e no fim do arraste, nunca durante o arraste, e uma resposta atrasada de um ponto anterior é descartada;
    - **cartão de sugestão** (`role="status"`): "Buscando endereço…" enquanto espera; depois "Endereço sugerido: <formattedAddress>" com os botões "Usar este endereço" (aplica `applyAddressSuggestion` com `shouldDirty` e `shouldValidate` e fecha o cartão) e "Dispensar". Sem `number` na sugestão, o texto de apoio "Confira o número depois de usar o endereço."; com `source: "mock"`, o aviso de busca simulada no mesmo estilo do cadastro de loja. `404` mostra "Não encontramos um endereço para este ponto. Preencha os campos abaixo." sem apagar o ponto; `503` vira toaster;
    - **"Localizar endereço no mapa"** (acima do mapa): habilitado com logradouro e cidade preenchidos; chama `GET /geocoding` com `addressSearchText`, move o marcador e a câmera para o resultado, grava o ponto e mostra "Endereço encontrado: <formattedAddress>", **sem** mudar os campos;
    - **ponto desatualizado:** se, depois de o ponto ser marcado ou a sugestão ser usada, o usuário mudar à mão CEP, logradouro, número, bairro, cidade ou UF (complemento não conta), exibir "O endereço mudou depois de o ponto ser marcado. Confira o ponto no mapa." com o botão "Localizar endereço no mapa". O ponto não é apagado;
    - **"Remover ponto"**: aparece quando há ponto, grava `null` e esconde o marcador e o cartão;
    - texto de apoio: "Clique no mapa ou arraste o marcador até a porta de entrada. Sugerimos o endereço do ponto, e você decide se usa.";
    - **sem chave pública ou com a chave recusada:** o mapa simulado (reaproveitar a ilustração `/images/store-map-mock.svg` e o selo "Mapa simulado"), com o botão "Usar ponto de exemplo", que marca o ponto da loja selecionada (ou o da Avenida Paulista) e segue o mesmo fluxo de sugestão. Com a chave recusada, também o aviso de falha do cadastro de loja.
  - `my-account-form.component.tsx`: `<form noValidate>` no visual da loja (cards, `Label`/`Input` e espaçamentos do checkout, não do admin), com os cartões:
    - **Dados pessoais:** nome e email do usuário da sessão, somente leitura, com o apoio "Nome e email são da sua conta de acesso."; CPF e telefone com máscara, lado a lado em telas largas;
    - **Endereço de entrega:** `CustomerAddressMap` acima de `CustomerAddressFields` (`idPrefix="account"`);
    - rodapé com "Salvar dados" ("Salvando…" durante o envio), desabilitado sem alterações, e "Descartar alterações" (volta aos valores carregados) quando há alterações.
- **Página e rota:**
  - `modules/customers/pages/my-account.page.tsx` (`MyAccountPage`), no container de 1080px do checkout, com o título "Minha conta":
    - sem sessão: o `AuthForm` na mesma URL, como no `CheckoutGate`, com o título "Entre para ver sua conta";
    - carregando o cadastro: cartões creme estáticos, sem shimmer;
    - sem cadastro de cliente: o apoio "Preencha uma vez e seus pedidos saem mais rápido." e o formulário vazio, com cidade e UF da loja selecionada (`storefront.city`/`storefront.state`) e o bairro da vitrine quando atendido;
    - com cadastro: o formulário com os dados atuais;
    - usar `useMyCustomer()` (o `save` já atualiza o estado compartilhado pelo checkout) e, para o centro do mapa, `useStorefront().storeSlug` + `useStorefrontStores().findBySlug`.
  - Rota `apps/frontend/src/app/(public)/minha-conta/page.tsx` com `<Suspense>` (a página usa `useSearchParams`); em `storefront-routes.ts`, `MY_ACCOUNT_ROUTE = '/minha-conta'` e `myAccountRoute(query?)` com `withQuery`. A página usa o **cabeçalho completo** da loja (não o compacto).
- **Menu da conta** (`AccountControl`): acrescentar "Minha conta" (ícone `UserRound`), antes de "Área administrativa", para todos os usuários logados, levando a query atual da vitrine (`myAccountRoute(storefront.query)`), para o bairro e a loja selecionados seguirem para a página. Trocar o subtítulo fixo "Conta do escritório" pelo email do usuário (administradores continuam com "Administrador"). Sair em "Minha conta" mantém a página e volta ao `AuthForm`.
- Atualizar `apps/frontend/DESIGN.md` com a seção "Minha conta (`/minha-conta`)" e o item no menu da conta, e os `index.ts` dos módulos `customers` e `stores`.
- Validação: `npm run lint --workspace=@jaja/frontend` e `npm run build --workspace=@jaja/frontend` sem erros. Conferir no navegador:
  - com um usuário comum do seed **sem** cadastro de cliente, a partir de `/?bairro=Bela Vista`: menu → "Minha conta", o mapa centrado na Loja Paulista, marcar um ponto próximo, a sugestão, "Usar este endereço" preenchendo os campos, CPF e telefone, salvar e recarregar a página mantendo o ponto;
  - a partir de `/?bairro=Centro`: o mapa centrado na Loja Rio Branco;
  - com um usuário **com** cadastro do seed (São Paulo ou Rio de Janeiro, sem ponto): digitar outro endereço, "Localizar endereço no mapa", salvar; depois mudar o número e ver o aviso de ponto desatualizado;
  - no checkout do mesmo usuário, "Alterar" e salvar os dados de entrega sem mudar o ponto (conferir em "Minha conta" ou em `GET /me/customer`), e a edição do cliente no admin também preservando o ponto;
  - sem `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: o mapa simulado, "Usar ponto de exemplo" e a sugestão `mock`;
  - o cadastro de loja no admin continua funcionando com o mapa (a extração para `src/shared/maps` não mudou nada);
  - mobile (375px): "Minha conta" sem rolagem horizontal, com os campos em uma coluna.

- **Specs da change:**
  - nova capability `customers/my-account`: página "Minha conta" pelo menu da conta, estados sem sessão, sem cadastro e com cadastro, dados pessoais somente leitura e editáveis, endereço pelos campos e pelo mapa, sugestão por ponto, localizar endereço digitado, ponto desatualizado, remover ponto e mapa simulado;
  - em `customers/customer-registration`: alterar "Dados do cliente" (ponto opcional do endereço, sempre com as duas coordenadas, arredondado e validado) e "Cadastro de cliente pelo próprio usuário" (regra de preservação do ponto; vale também para a alteração pela administração);
  - em `stores/address-geocoding`: substituir "Geocodificação restrita a administradores" por "Geocodificação exige usuário autenticado"; acrescentar "Sugerir endereço a partir de um ponto" (`GET /geocoding/reverse`, componentes nulos, coordenadas do ponto consultado) e o cenário de ponto em "Geocodificação simulada sem chave do servidor";
  - nova capability `stores/storefront-stores`: `GET /storefront/stores` público, só lojas ativas e sem dados administrativos;
  - em `auth/storefront-access`: alterar "Controle de conta no cabeçalho da loja" para descrever o menu atual (nome, email ou "Administrador", "Minha conta", "Área administrativa" só para administradores e "Sair"). O texto de hoje ("olá, <primeiro nome>", sem acesso ao admin) já não corresponde ao código.

> Obs: IMPORTANTE!!! Executar as três partes (Negócio, Backend e Frontend) em subagentes separados, cada um com contexto limpo, de forma sequencial:
> - o Backend depende do build de `@jaja/customers` e `@jaja/stores`;
> - o Frontend depende de `GET /geocoding/reverse`, `GET /storefront/stores` e do ponto em `/me/customer`.
>
> Antes de começar, conferir que os prompts 10 e 11 estão implementados (`GeocodingProvider`, `store-location-map.component.tsx`, `MyCustomerController` e `CustomerDeliveryForm`); se não estiverem, parar e reportar.
>
> Cada subagente deve ler `.claude/skills/skills-standards.md` e, antes de criar seus arquivos, as referências de código da sua camada listadas no Contexto. Também:
> - o do backend não mata backends já rodando (usa outra porta se a 4000 estiver ocupada), deixa o seed como estava e nunca registra nem expõe `GOOGLE_MAPS_API_KEY`;
> - o do frontend lê também `apps/frontend/DESIGN.md`;
> - nenhum subagente altera `packages/shared`;
> - a conferência com o Google Maps real (com as duas chaves) é repetida na conversa principal, com o usuário.
>
> Uma parte só começa depois de a anterior terminar com as validações passando, e cada subagente encerra listando os arquivos criados ou alterados e o resultado das validações.
