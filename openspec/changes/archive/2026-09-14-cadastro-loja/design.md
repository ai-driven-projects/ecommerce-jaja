## Context

A motivação e o escopo estão em `proposal.md`. O comportamento está nas specs desta change: `stores/store-registration`, `stores/address-geocoding`, `stores/store-admin`, `admin/admin-api-authorization` e `catalog/storefront`. O roteiro de implementação detalhado é o prompt `openspec/extras/prompts/10-cadastro-loja.md`, sincronizado com as decisões abaixo. Este é o estado atual relevante.

**Domínio**
- `modules/stores` tem só o scaffold gerado sem spec: `src/stores` (`Stores` só com `id`, `CreateStores`, `StoresDTO { id }`, `StoresRepository`), `test/stores/create-stores.use-case.test.ts` e o mock `in-memory-stores.repository.ts`, que falha com `ENTITY_NOT_FOUND`. Há também `getModuleName()` com `test/index.test.ts`.
- O shared oferece `Name`, `Alias` (com `Alias.format`), `Text`, `Phone` (8 a 15 dígitos, guarda só dígitos), `Flag` e `Id`, mas nenhum VO geográfico. `ProductImage` é a referência de VO com mais de um campo, e `errors.ts` de `product` a de constantes de limite.

**Backend**
- `stores.controller.ts` expõe `GET /stores` público de exemplo, e `stores.prisma.ts` só expõe o client. `stores.model.prisma` está vazio.
- `ConfigModule` é global (`shared.module.ts`), e `main.ts` carrega `dotenv/config`. Não existe nenhuma integração HTTP com serviço externo; o Node do projeto já tem `fetch` nativo.
- `brand.prisma.ts` é a referência de adapter:
  - `UNIQUE_VIOLATIONS` por nome de constraint, lido de `meta.driverAdapterError.cause.constraint`;
  - `isUuid` antes de ir ao banco;
  - SQL com `folded`/`toPrefixTsQuery` de `modules/catalog/text-search.sql.ts`.

**Frontend**
- **Módulo:**
  - `/admin/stores` renderiza `StoresDashboardComponent`, com `COVERAGE_ROWS` locais e um `EmptyDashboardState` que promete o editor "com a API de lojas";
  - `sectionsByModuleId.stores = []`, e `stores-routes.ts` só tem `STORES_ROUTE`;
  - `withQuery` é privado de `catalog-routes.ts`.
- **Mapa:** não há biblioteca de mapas; `next.config.ts` não define CSP, e `public/` está vazio.
- **Constantes:** o frontend não importa pacotes `@jaja/*`, então os limites do domínio são repetidos nos schemas (ex.: `product.schema.ts`).
- **Mensagens:** faltam as de `PHONE_INVALID_FORMAT` e `PHONE_INVALID_LENGTH`.

**Change em andamento: `cadastro-cliente`** (etapa de Negócio iniciada)
- Move `text-search.sql.ts` para `apps/backend/src/db/`, extrai `withQuery` para `src/shared/navigation/with-query.util.ts` e adiciona as mensagens `PHONE_*`.
- Altera o requirement "Endpoints não administrativos não mudam" de `admin/admin-api-authorization`, o mesmo que esta change altera.

## Goals / Non-Goals

**Goals:**
- Cadastro de lojas no padrão de `brand`, com a área de atendimento expressa como ponto + raio.
- Mapa real quando houver chaves, e o fluxo completo e verificável sem nenhuma chave: desenvolvimento, CI e alunos sem conta no Google.
- A chave capaz de consultar endereços nunca chega ao navegador.
- Deixar o prompt de pedidos com `store.id` e `useStoreOptions` prontos para uso.

**Non-Goals:**
- Serviço de domínio de cobertura (distância de Haversine): nenhuma regra o consumiria nesta change.
- PostGIS ou índice geoespacial: são poucas lojas e não há consulta por distância.
- Autocomplete de endereço (Places API), geocodificação reversa e distância por trajeto (Routes API).
- Compartilhar o modelo de endereço com o cadastro de cliente.

## Decisions

### 1. Três etapas sequenciais com contexto limpo
Negócio → Backend → Frontend, cada uma em um subagente com contexto limpo, como pede o prompt. Cada etapa só começa com as validações da anterior passando, porque backend e frontend consomem o `dist` de `@jaja/stores`.

### 2. Substituir o scaffold, no singular
O scaffold `stores` é apagado, e `module-aggregate store --mode example` gera o agregado `store`; o use case e o teste de exemplo gerados são removidos. As rotas seguem o padrão de Clientes, módulo com um único cadastro: a lista em `/admin/stores` e o formulário em `/admin/stores/new` e `/admin/stores/[id]` (Decisão 13).

### 3. Área de atendimento como ponto + raio em linha reta
A loja guarda `latitude`, `longitude` e `deliveryRadiusMeters`. O raio é informativo: a verificação futura será um serviço de domínio que compara a distância em linha reta com o raio, a partir do endereço do cliente geocodificado no servidor.

Alternativas descartadas:
- Lista de bairros atendidos (primeira versão do prompt 10): um bairro pode ser grande demais para ser atendido inteiro.
- Polígono desenhado no mapa: mais complexo de editar e validar, e a Drawing Library do Maps JavaScript API está descontinuada.

### 4. Endereço de referência em texto livre, separado do endereço do cliente
Para a loja, o essencial é o ponto e o raio; o endereço serve para localizar o ponto e para exibição. Por isso ele é um único `address` opcional (até 200 caracteres), que o provedor geocodifica bem mesmo sem estrutura.

Alternativas descartadas:
- Alinhar ao `CustomerAddress` (CEP, UF, bairro etc.): o cliente precisa de um endereço de entrega completo, que é uma necessidade diferente. Isso também duplicaria `ZipCode` e `StateCode` entre módulos, que não podem importar um do outro.
- Campos estruturados opcionais: a validação parcial fica confusa (CEP sem cidade, UF sem rua), sem ganho para o raio.

### 5. Coordenadas e raio como objetos de valor
- **`GeoPoint`:** VO com dois campos, como `ProductImage`. Valida os intervalos e arredonda para 6 casas decimais (cerca de 11 cm), de modo que o mesmo valor volte igual do banco.
- **`DeliveryRadius`:** inteiro de 300 a 10.000 m.
- **Códigos de erro:** `GEO_POINT_LATITUDE_INVALID`, `GEO_POINT_LONGITUDE_INVALID` e `DELIVERY_RADIUS_INVALID`, com os limites em `errors.ts` (`STORE_MIN_DELIVERY_RADIUS_METERS`, `STORE_MAX_DELIVERY_RADIUS_METERS` e `STORE_DEFAULT_DELIVERY_RADIUS_METERS`).
- **Banco:** as colunas são `Float` (double precision), e não `Decimal`. O arredondamento no domínio já garante valores estáveis, e `Decimal` exigiria converter `Prisma.Decimal` em todo mapeamento.

### 6. Geocodificação atrás do backend, com contrato no domínio
- **Contrato:** `modules/stores/src/geocoding` declara `GeocodingProvider`, `GeocodingResultDTO` e `GeocodingErrors`, sem conhecer o Google.
- **Implementações:** o backend implementa `GoogleGeocodingProvider` e `MockGeocodingProvider`. A escolha é feita em `stores.module.ts`, com `useFactory` + `ConfigService` e o token `GEOCODING_PROVIDER`, porque interfaces não existem em tempo de execução. Com `GOOGLE_MAPS_API_KEY` preenchida usa-se o Google; sem ela, o mock, com um aviso na inicialização.
- **Controller:** `GeocodingController` chama o provider diretamente, como as queries de leitura.
- **Rota:** `GET /geocoding`, e não `/stores/geocode`, para não disputar com `GET /stores/:id` e para poder ser reaproveitada pelo checkout no futuro.
- **Mapeamento do Google:**
  - `OK` → primeiro resultado;
  - `ZERO_RESULTS` → ok com `null` (`404`);
  - demais status, erro de rede e `AbortSignal.timeout(5000)` → `GEOCODING_UNAVAILABLE` (`503`).
- **Log:** só o `status` e o `error_message` do Google, nunca a URL, que contém a chave.

Alternativas descartadas:
- `google.maps.Geocoder` no navegador: exigiria liberar a Geocoding API na chave pública.
- Places Autocomplete: session tokens, widget próprio e custo por sessão, fora do escopo.
- Geocodificar dentro de `SaveStore`: salvar a loja passaria a depender da disponibilidade do Google, e o administrador perderia o ajuste fino do ponto.

### 7. Duas chaves com restrições distintas
- **`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`:** pública por natureza, porque o Next a embute no JavaScript. Libera só a Maps JavaScript API, com restrição por referrer e limite diário.
- **`GOOGLE_MAPS_API_KEY`:** secreta, só no backend. Libera só a Geocoding API.
- **`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`:** opcional, com `DEMO_MAP_ID` como padrão, porque marcadores avançados exigem um Map ID.

As três ficam documentadas nos `.env.example`, sem valores reais.

### 8. Modo simulado decidido no frontend
- **Quando entra:** `isGoogleMapsConfigured` vem da variável pública. Uma falha de carregamento também troca para o modo simulado: erro do `APIProvider` ou `window.gm_authFailure`, chamado pelo Google quando recusa a chave.
- **Valores:** `STORE_MOCK_LOCATION` (Avenida Paulista, 1578; raio de 1.000 m) fica em `store-location.util.ts`, repetindo os valores do `MockGeocodingProvider`.
- **Criação:** começa com os valores simulados.
- **Edição:** preserva o ponto salvo, e só a seleção explícita da imagem aplica o ponto simulado. Sem isso, editar o telefone de um hub de Fortaleza sem a chave moveria a loja para São Paulo.
- **Imagem:** um SVG próprio em `public/images/store-map-mock.svg`. Capturas do Google Maps ou do OpenStreetMap esbarram em termos de uso e licenças.

### 9. Campos numéricos como fonte da verdade, e o mapa como editor
- **Estado:** latitude, longitude e raio são campos do `react-hook-form`. O mapa só lê e grava esses campos (`setValue` com `shouldDirty`/`shouldValidate`), e é por eles que ficam garantidos o uso por teclado, a validação e os testes no navegador.
- **Biblioteca:** `@vis.gl/react-google-maps` (`APIProvider`, `Map`, `AdvancedMarker`, `useMap`), compatível com React 19.
- **Círculo:** `google.maps.Circle` é criado em um `useEffect` com `useMap()` (`editable: true`, ouvindo `radius_changed` e `center_changed`). A biblioteca não traz um componente de círculo pronto.
- **Sincronização:** o raio vindo do mapa passa por `normalizeRadius` (múltiplos de 50 m, limitado ao intervalo). Os dois lados comparam antes de aplicar, para evitar laço de atualização.

Alternativas descartadas:
- Leaflet + OpenStreetMap: dispensaria chave, mas o Google Maps foi a escolha do produto.
- Carregar o script do Maps à mão: repetiria o carregamento e o ciclo de vida que a biblioteca já resolve.

### 10. Listagem e busca no padrão de `BrandPrisma`
`findStores` usa `count` + `LIMIT/OFFSET` e um `tsvector` com peso A (`name`, `slug`) e peso B (`address`). Aplica `ts_rank` quando há busca e ordena por `name COLLATE "pt-BR-x-icu", id`. A lista usa o próprio `StoreDTO`, porque não há relações nem campos pesados que justifiquem um DTO resumido.

### 11. Coordenação com `cadastro-cliente`
- **Passos compartilhados idempotentes:**
  - mover `text-search.sql.ts` para `apps/backend/src/db/` só se ainda estiver no catálogo;
  - extrair `withQuery` para `src/shared/navigation/with-query.util.ts` só se ainda não existir;
  - adicionar `PHONE_*` só se faltar.

  Os caminhos e as chaves são os mesmos da outra change, então a ordem de implementação é indiferente.
- **`formatPhone`:** vai para `src/shared/util/phone.util.ts`. Se `cadastro-cliente` já tiver criado a função em `customer.util.ts`, ela é movida para o shared e importada nos dois módulos, sem duplicar.
- **Delta de `admin/admin-api-authorization`:** as duas changes alteram o mesmo requirement, e a que for arquivada por último tem a delta reescrita a partir do spec principal já atualizado. A lista combinada fica: `GET /` e `/orders` públicos; `/customers` e `/stores`/`/geocoding` administrativos; `/me/customer` só com token.

### 12. Seed escrito à mão e versionado
`stores.json` tem a "Loja Aldeota" e a "Loja Cocó", com endereços fictícios e coordenadas aproximadas em Fortaleza. A task `stores-stores` faz `upsert` por `slug` com `update: {}`: não sobrescreve edições nem recria lojas excluídas. Ela roda depois de `catalog-products`, sem dependências. O CLI não participa, porque não são dados raspados.

### 13. Termo "loja" e fim dos hubs fictícios
Depois da implementação inicial, "hub" e "Hubs & cobertura" foram trocados por "loja" em toda a aplicação, e os hubs fictícios saíram:
- **Módulo:** segue o padrão de Clientes, com um único cadastro. O item "Lojas" não tem sub-itens, a lista fica em `/admin/stores` e o formulário em `/admin/stores/new` e `/admin/stores/[id]`. A visão geral mock e a rota repetida `/admin/stores/stores` deixam de existir.
- **Admin:** o rodapé do menu deixa de mostrar um nome de loja fixo, a tela de acesso fala em "equipe das lojas" e o dashboard `/admin` perde o card mock de área de cobertura.
- **Vitrine, checkout e rastreio:** os dados continuam locais, mas tipos, identificadores e textos passam a usar `store`/"loja" (ex.: `Zone.store`, "Em estoque na Loja Aldeota"). Isso gera a delta de `catalog/storefront`.
- **Seed:** passa a ter "Loja Aldeota" (`loja-aldeota`) e "Loja Cocó" (`loja-coco`). Os dois registros do banco local foram renomeados por SQL, porque o `upsert` por slug com `update: {}` não renomearia nada e criaria duplicatas.

Alternativa descartada: manter sub-itens com uma visão geral reescrita com dados da API. O menu ficaria "Lojas > Lojas", sem ganho de informação.

## Risks / Trade-offs

- **[`NEXT_PUBLIC_*` é embutida no build]** → Trocar a chave exige reiniciar o `next dev` ou refazer o build. Documentado no `.env.example`.
- **[Chave pública copiada para outro site]** → Restrição por referrer, só a Maps JavaScript API e limite diário. O referrer pode ser falsificado fora do navegador, mas o limite contém o custo.
- **[Google exige conta de faturamento]** → O modo simulado cobre todo o fluxo, e nenhum teste automatizado depende do Google.
- **[Geocodificação imprecisa para texto livre]** → O endereço é só referência, e o administrador ajusta o ponto no mapa ou nos campos.
- **[Laço de atualização entre formulário, marcador e círculo]** → Os dois lados comparam antes de aplicar e usam o mesmo arredondamento (6 casas; raio em múltiplos de 50 m).
- **[Raio confundido com regra de atendimento]** → Texto de apoio no formulário e comentário no model Prisma. A spec declara o raio informativo.
- **[Conflitos com `cadastro-cliente`]** → Passos compartilhados idempotentes e a reconciliação da delta de autorização ao arquivar (Decisão 11).
- **[BREAKING `GET /stores`]** → O endpoint de exemplo não tem consumidores, porque o dashboard não chama a API. A delta de `admin-api-authorization` registra a mudança.
- **[Coordenadas do seed aproximadas]** → São dados só de desenvolvimento.

## Migration Plan

1. `npm run build --workspace=@jaja/stores` ao fim da etapa de Negócio.
2. `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name stores_store`: cria só a tabela `stores` com `stores_name_key` e `stores_slug_key`. Depois, `prisma:generate`.
3. `npm run prisma:seed --workspace=@jaja/backend`, idempotente; `--only=stores` roda só a nova task.
4. As chaves do Google são opcionais e podem ser configuradas a qualquer momento; sem elas, o sistema opera no modo simulado.
5. Rollback em desenvolvimento: reverter o commit e recriar o banco com `prisma migrate reset`. Não há dados de produção.

## Open Questions

- Domínio de produção a incluir na restrição por referrer da chave pública: é definido no deploy e não muda specs, abordagem nem tarefas.
