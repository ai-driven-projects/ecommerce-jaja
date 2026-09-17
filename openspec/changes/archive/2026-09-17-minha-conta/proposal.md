## Why

Hoje o usuário logado só vê e altera CPF, telefone e endereço no passo 1 do checkout, e o endereço é só texto. Os próximos prompts precisam saber **onde** o cliente está (dentro do raio de alguma loja, qual loja atende). Por isso o usuário precisa de uma página "Minha conta", aberta pelo menu da conta na loja, onde informa o endereço digitando os campos ou marcando o ponto no mapa. O ponto fica gravado no cadastro do cliente.

## What Changes

- **Domínio de clientes (`@jaja/customers`):**
  - novo VO `CustomerLocation` (latitude/longitude, 6 casas, mesmos limites do `GeoPoint`, sem importar `@jaja/stores`) e erro `CUSTOMER_LOCATION_INVALID`;
  - `CustomerAddress` ganha `location` opcional (`null` quando ausente), comparado em `equals`; `CustomerAddressDTO` ganha `location: CustomerLocationDTO | null`;
  - `SaveCustomer` com **regra de preservação do ponto**: na alteração, `location` ausente mantém o ponto atual, `null` remove e um objeto substitui. Assim o checkout e a edição administrativa, que não mostram o mapa, não apagam o ponto.
- **Geocodificação (`@jaja/stores` + backend):**
  - `GeocodingProvider.reverseGeocode(point)` com `AddressSuggestionDTO` (ponto consultado, endereço formatado, componentes `string | null` e `source`) e erro `GEOCODING_LOCATION_INVALID`;
  - implementações Google (`latlng`, mapeamento de `address_components`, `fetch` compartilhado com o `geocode`) e simulada (endereço fixo da Avenida Paulista);
  - novo `GET /geocoding/reverse?latitude=&longitude=`;
  - **BREAKING (acesso):** `GET /geocoding` e `GET /geocoding/reverse` deixam de ser só de administradores e passam a exigir apenas token válido. A chave do Google continua só no servidor.
- **Lojas na vitrine:** nova query `FindStorefrontStoresQuery` e `GET /storefront/stores` **público**, só com lojas ativas e sem dados administrativos (sem telefone, status nem datas).
- **Banco:** colunas opcionais `latitude`/`longitude` em `customers`, com a constraint "as duas ou nenhuma". A migration não altera dados, e o seed não muda.
- **Clientes no backend:** `customer.prisma.ts` lê e grava o ponto no detalhe. `customer-http.ts` repassa `location` sem trocar `undefined` por `null`, em `/me/customer` e em `PUT /customers/:id`.
- **Frontend:**
  - página `/minha-conta` (`MyAccountPage`) com dados pessoais (nome e email só leitura, CPF e telefone editáveis) e endereço de entrega;
  - `CustomerAddressMap`:
    - mapa centrado na loja selecionada na vitrine, com todas as lojas ativas marcadas e o círculo da área de atendimento de cada uma (informativo), mais a lista das lojas e seus raios abaixo do mapa;
    - marcar o ponto por clique ou arraste;
    - sugestão de endereço aplicada só por "Usar este endereço";
    - "Localizar endereço no mapa";
    - aviso de ponto desatualizado;
    - "Remover ponto";
    - mapa simulado com "Usar ponto de exemplo";
  - estados sem sessão (`AuthForm` na mesma URL), carregando, sem cadastro e com cadastro;
  - menu da conta com "Minha conta" (levando a query da vitrine) e o email do usuário no subtítulo, em vez do fixo "Conta do escritório";
  - extração da configuração do Google Maps e da detecção de chave recusada para `src/shared/maps`, sem mudar o cadastro de loja;
  - `storeSlug` no mock `ZONES` e em `useStorefront()`; `useStorefrontStores()` para as coordenadas da loja;
  - checkout e edição administrativa devolvem o ponto recebido, sem editá-lo;
  - `DESIGN.md` com a seção "Minha conta".
- **Testes:**
  - jest do VO, do endereço e do `SaveCustomer`;
  - Vitest dos provedores de geocodificação;
  - `.http` de clientes, geocodificação e lojas da vitrine.
- Fora do escopo:
  - cobertura por raio, bloqueio de pedidos e sugestão de loja;
  - ponto no endereço do pedido;
  - mapa no checkout e no admin de clientes;
  - alterar nome, email ou senha;
  - vários endereços, "Meus pedidos", geolocalização do navegador, ViaCEP e Places;
  - limite de chamadas;
  - trocar `ZONES` por lojas reais;
  - mudar o seed de clientes;
  - alterações em `packages/shared`.

## Capabilities

### New Capabilities

- `customers/my-account`:
  - página "Minha conta" aberta pelo menu da conta;
  - estados sem sessão, sem cadastro e com cadastro;
  - dados pessoais somente leitura e editáveis;
  - endereço pelos campos e pelo mapa;
  - sugestão de endereço por ponto;
  - localizar o endereço digitado;
  - ponto desatualizado, remover ponto e mapa simulado.
- `stores/storefront-stores`: `GET /storefront/stores` público, só com lojas ativas e sem dados administrativos.

### Modified Capabilities

- `customers/customer-registration`:
  - "Dados do cliente" ganha o ponto opcional do endereço, sempre com as duas coordenadas, arredondado e validado;
  - "Cadastro de cliente pelo próprio usuário" ganha a regra de preservação do ponto;
  - "Alterar cliente pela administração" segue a mesma regra de preservação.
- `stores/address-geocoding`:
  - "Geocodificação restrita a administradores" é substituída por "Geocodificação exige usuário autenticado";
  - novo requisito "Sugerir endereço a partir de um ponto";
  - "Geocodificação simulada sem chave do servidor" ganha o cenário do ponto.
- `auth/storefront-access`: "Controle de conta no cabeçalho da loja" passa a descrever o menu atual (nome, email ou "Administrador", "Minha conta", "Área administrativa" só para administradores e "Sair"). O texto de hoje ("olá, <primeiro nome>", sem acesso ao admin) já não corresponde ao código.
- `admin/admin-api-authorization`: "Endpoints não administrativos não mudam" deixa de citar `/geocoding` como administrativo, cita `GET /storefront/stores` como público e troca o cenário de `403` da geocodificação com token comum.

## Impact

- `modules/customers`:
  - `src/customer/model/customer-location.vo.ts` (novo), `customer-address.vo.ts`, `index.ts`;
  - `src/customer/dto/customer.dto.ts`, `errors.ts`, `use-case/save-customer.use-case.ts`;
  - testes em `test/customer/`.
- `modules/stores`:
  - `src/geocoding/dto/address-suggestion.dto.ts` (novo), `provider/geocoding.provider.ts`, `errors.ts`;
  - `src/store/dto/storefront-store.dto.ts` e `provider/find-storefront-stores.query.ts` (novos);
  - `index.ts`.
- `apps/backend`:
  - `prisma/models/customers.model.prisma` e a migration `customers_location`;
  - `src/modules/customers/customer.prisma.ts`, `customer-http.ts` e `test/customer.integration.http`;
  - `src/modules/stores/geocoding.controller.ts`, `google-geocoding.provider.ts` (e `.spec.ts`), `mock-geocoding.provider.ts` (e `.spec.ts`), `store.prisma.ts` e `stores.module.ts`;
  - `storefront-store.controller.ts` (novo);
  - `test/geocoding.integration.http` e `test/storefront-store.integration.http` (novo).
- `apps/frontend`:
  - `src/shared/maps/*` (novos);
  - `src/shared/i18n/messages.pt.ts` e `messages.en.ts`;
  - `src/shared/components/store/storefront-header.component.tsx` e `src/shared/navigation/storefront-routes.ts`;
  - `modules/stores`: `data/store-location.util.ts`, `geocoding.api.ts`, `storefront-store.api.ts` e `use-storefront-stores.hook.ts` (novos), `components/store-location-*.tsx` e `index.ts`;
  - `modules/catalog/data/storefront.mock.ts`, `storefront.types.ts` e `use-storefront.hook.ts`;
  - `modules/customers`:
    - `data/customer.api.ts`, `customer.schema.ts`, `customer-form.util.ts`, `customer-address.util.ts` e `use-my-account-form.hook.ts` (novos);
    - `components/customer-address-map.component.tsx` e `my-account-form.component.tsx` (novos);
    - `pages/my-account.page.tsx` (novo);
    - `index.ts`;
  - rota `src/app/(public)/minha-conta/page.tsx` (nova);
  - `DESIGN.md`.
- API:
  - novos `GET /geocoding/reverse` e `GET /storefront/stores`;
  - `/geocoding` aberto a qualquer usuário autenticado;
  - `address.location` em `/me/customer` e `/customers/:id`, acrescentado sem quebrar clientes que não o enviam.
- Sem mudanças em pedidos, no seed, em `packages/shared` ou no uso da chave do Google no servidor.
