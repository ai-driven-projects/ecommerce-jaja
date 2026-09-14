## Why

Os próximos pedidos precisam sair de uma loja, o ponto de entrega rápida do Jaja, mas esse cadastro não existe. Hoje `@jaja/stores` é só um scaffold gerado sem spec e o backend expõe um `GET /stores` público de exemplo. No admin, o módulo "Hubs & cobertura" mostra lojas e bairros fixos em dados locais. Além disso, bairro é uma unidade ruim para a cobertura: um bairro pode ser grande demais para ser atendido inteiro. Esta change cria o cadastro de lojas com o que de fato define o atendimento, um ponto no mapa e um raio de entrega, e padroniza o termo "loja" na aplicação, removendo os hubs fictícios.

## What Changes

- **Modelo de negócio**:
  - a loja tem nome, slug, telefone opcional, um **endereço de referência** opcional em texto livre, um **ponto** (latitude e longitude), um **raio de atendimento** em metros (300 a 10.000, padrão 1.000) e status;
  - o endereço da loja não é estruturado como o endereço de entrega do cliente, porque serve só para localizar o ponto e para exibição;
  - o raio é **informativo**: nenhuma regra de pedido, checkout ou vitrine o consulta nesta change.
- **Domínio (`@jaja/stores`)**: substituir o scaffold `stores` (entidade `Stores`, `CreateStores`, DTO, mock e teste de exemplo) pelo agregado `store`. Ele terá:
  - VOs `GeoPoint` e `DeliveryRadius`, a entidade `Store`, `StoreRepository` (com `findBySlug` e `findByName`), `StoreDTO`/`StorePageDTO` e as queries `FindStoresQuery` (paginada, com busca) e `FindStoreByIdQuery`;
  - os casos de uso `SaveStore` (cria ou altera, com unicidade de nome e slug) e `DeleteStore` (exclusão lógica);
  - o contrato `GeocodingProvider` em `src/geocoding`, sem conhecer o Google.

  Testes com jest e mock in-memory.
- **Backend (`@jaja/backend`)**:
  - model `Store` (tabela `stores`) e migration `stores_store`;
  - adapter `StorePrisma` com a busca textual SQL; `text-search.sql.ts` sai do catálogo para `src/db/`, se a change `cadastro-cliente` ainda não tiver feito isso;
  - `POST`, `GET`, `PUT` e `DELETE` em `/stores`, restritos a administradores;
  - `GET /geocoding?address=`, restrito a administradores. Com `GOOGLE_MAPS_API_KEY` (chave secreta, só a Geocoding API) consulta o Google; sem ela, responde sempre com um ponto simulado na Avenida Paulista;
  - seed idempotente com a "Loja Aldeota" e a "Loja Cocó", em Fortaleza, e testes de integração Rest Client;
  - **BREAKING**: o endpoint de exemplo `GET /stores`, hoje público, é removido, e `/stores` passa a exigir JWT de administrador.
- **Frontend (`@jaja/frontend`)**:
  - **Módulo "Lojas" no admin**, estruturado como Clientes: o item "Hubs & cobertura" vira "Lojas", sem sub-itens. `/admin/stores` passa a ser a lista paginada, com busca na URL, e o formulário fica em `/admin/stores/new` e `/admin/stores/[id]`. A visão geral com hubs e bairros de exemplo é removida.
  - **Formulário:** com a chave `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (pública, só a Maps JavaScript API), a localização usa o Google Maps: marcador arrastável, círculo de raio editável, botão "Localizar endereço no mapa" e campos numéricos sincronizados. Sem a chave, ou se o mapa não carregar, entra o **mapa simulado**: uma imagem ilustrativa com o selo "Mapa simulado", o ponto fixo da Avenida Paulista e raio de 1 km.
  - **Nomenclatura "loja" em toda a aplicação:**
    - no admin, sai o nome de loja fixo do rodapé do menu, a tela de acesso passa a dizer "equipe das lojas" e o dashboard `/admin` perde o card mock de área de cobertura;
    - na vitrine, no checkout e no rastreio de pedido, "hub" vira "loja" nos dados locais e nos textos, como nos bairros agrupados por loja e em "Em estoque na Loja Aldeota".
  - **Compartilhado:** mensagens pt/en dos novos códigos; `withQuery` extraído para `src/shared/navigation/with-query.util.ts`, se ainda não tiver sido.
  - **Dependência nova:** `@vis.gl/react-google-maps`.
- **Fora do escopo**:
  - verificar se um endereço está dentro do raio; pedidos continuam aceitos para qualquer endereço, qualquer que seja a loja;
  - autocomplete de endereço, geocodificação reversa e distância por trajeto;
  - integrar a vitrine e o dashboard `/admin` à API, que continuam com dados locais;
  - horário de funcionamento, estoque por loja e vínculo de operadores ou entregadores;
  - a regra que impede excluir loja com pedidos, que entra com o agregado de pedido.

## Capabilities

### New Capabilities

- `stores/store-registration`: dados da loja com ponto e raio de atendimento, validações, unicidade de nome e slug, criação, listagem paginada com busca, detalhe, alteração e exclusão lógica pela API `/stores` restrita a administradores, e carga inicial das lojas de desenvolvimento.
- `stores/address-geocoding`: busca de coordenadas a partir de um endereço em `GET /geocoding`, restrita a administradores, com o provedor real quando a chave do servidor está configurada, a resposta simulada quando não está, e a proteção da chave.
- `stores/store-admin`: telas de lojas em `/admin/stores` (lista com busca na URL e formulário em página com a localização no Google Maps ou no mapa simulado), o item "Lojas" do menu e o termo "loja" na área administrativa, sem lojas fictícias no rodapé do menu nem no dashboard.

### Modified Capabilities

- `admin/admin-api-authorization`: `/stores` deixa de estar entre os endpoints acessíveis sem token, e `/geocoding` nasce administrativo.
- `catalog/storefront`: os bairros atendidos da vitrine passam a ser agrupados por loja, e não por hub.

## Impact

- `modules/stores`:
  - remove `src/stores`, `test/stores` e `test/mock/in-memory-stores.repository.ts`;
  - cria `src/store/{model,provider,dto,use-case,errors.ts,index.ts}`, `src/geocoding/{dto,provider,errors.ts,index.ts}`, `test/store/**` e `test/mock/in-memory-store.repository.ts`.

  O backend e o frontend dependem de `npm run build --workspace=@jaja/stores`.
- `apps/backend`:
  - banco: `prisma/models/stores.model.prisma`, a nova migration, `prisma/seed/tasks/stores-stores.seed.ts`, `prisma/seed/data/stores.json` (novo, escrito à mão) e `prisma/seed/main.ts`;
  - módulo: `src/modules/stores/{store.prisma.ts,store.controller.ts,google-geocoding.provider.ts,mock-geocoding.provider.ts,geocoding.controller.ts,stores.module.ts,index.ts,test/*.integration.http}`, com os testes Vitest dos providers e a remoção de `stores.controller.ts` e `stores.prisma.ts`;
  - busca textual: `src/db/text-search.sql.ts` e os imports em `brand.prisma.ts`/`category.prisma.ts` (compartilhado com `cadastro-cliente`);
  - API nova: `POST /stores`, `GET /stores`, `GET/PUT/DELETE /stores/:id` e `GET /geocoding`;
  - configuração: `GOOGLE_MAPS_API_KEY` em `.env.example`.
- `apps/frontend`:
  - compartilhado: `src/shared/i18n/messages.{pt,en}.ts`, `src/shared/navigation/{app-modules.ts,stores-routes.ts,catalog-routes.ts,with-query.util.ts}`, `src/shared/util/phone.util.ts` e `src/shared/components/store/store.types.ts`;
  - módulo: `src/modules/stores/{data,components,pages,index.ts}` e `public/images/store-map-mock.svg`, com a remoção de `stores-dashboard.component.tsx` e `pages/dashboard.page.tsx`;
  - rotas: `src/app/admin/(shell)/stores/{page.tsx,new/page.tsx,[id]/page.tsx}`;
  - nomenclatura e mocks:
    - admin: `src/app/admin/(shell)/layout.tsx`, `src/modules/auth/pages/login.page.tsx`, `src/modules/admin/{components/admin-dashboard.component.tsx,data/dashboard.mock.ts}`;
    - vitrine, pedidos e checkout: os dados e componentes da vitrine em `src/modules/catalog`, `src/modules/orders/{data/tracking.mock.ts,components/order-tracking.component.tsx,pages/checkout.page.tsx}`;
  - configuração: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` e `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` em `.env.example`; dependência `@vis.gl/react-google-maps`.
- Serviço externo opcional: Google Maps Platform, com a Maps JavaScript API no navegador e a Geocoding API no servidor. Sem as chaves, tudo funciona no modo simulado.
- Coordenação com a change `cadastro-cliente`, em andamento: as duas movem `text-search.sql.ts`, extraem `withQuery`, adicionam as mensagens `PHONE_*` e alteram o mesmo requirement de `admin/admin-api-authorization`.
- Dados: tabela `stores` com 2 registros após o seed ("Loja Aldeota" e "Loja Cocó").
