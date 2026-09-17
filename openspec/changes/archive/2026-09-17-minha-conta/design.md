## Context

A motivação e o escopo estão em `proposal.md`. O comportamento está nas specs `customers/my-account` e `stores/storefront-stores` (novas) e nos deltas de `customers/customer-registration`, `stores/address-geocoding`, `auth/storefront-access` e `admin/admin-api-authorization`. O roteiro detalhado é o prompt `openspec/extras/prompts/19-minha-conta.md`. Este é o estado atual relevante, conferido no código antes desta change.

**Domínio**
- `CustomerAddress` (`modules/customers/src/customer/model/customer-address.vo.ts`) é um VO composto sem ponto. Ele valida cada campo com `Text`/`ZipCode`/`StateCode` e junta os resultados com `Result.combine`. O `SaveCustomer` monta o endereço com `toAddress(input.address)` tanto no `create` quanto no `update` privados, e o `update` já recebe a entidade existente.
- `GeoPoint` (`modules/stores/src/store/model/geo-point.vo.ts`) tem `MAX_LATITUDE`, `MAX_LONGITUDE`, `DECIMAL_PLACES = 6` e `round` (−0 → 0), com erros por coordenada (`GEO_POINT_LATITUDE_INVALID`/`..._LONGITUDE_INVALID`).
- `GeocodingProvider` tem só `geocode(address)`. `GeocodingErrors` tem `GEOCODING_ADDRESS_REQUIRED`, `GEOCODING_ADDRESS_NOT_FOUND` e `GEOCODING_UNAVAILABLE`.

**Backend**
- `GeocodingController` usa `@AdminOnly()` na classe e chama o provedor direto, sem use case. `GoogleGeocodingProvider.geocode` faz o `fetch` com `AbortSignal.timeout(5000)`, trata `ZERO_RESULTS`/status e registra só status e mensagem (`unavailable`, `redact`).
- `StorePrisma` expõe queries como atributos públicos (`findStores`, `findStoreById`) e já tem `NAME_ORDER` com `COLLATE "pt-BR-x-icu"`. O model `Store` tem `slug`, `address?`, `latitude`, `longitude`, `deliveryRadiusMeters`, `isActive` e `deletedAt`.
- `StorefrontController` (catálogo) é o padrão de controller público: não há guard global, então basta não declarar guard.
- `customer-http.ts#toInput` monta `address` campo a campo, e por isso hoje descarta qualquer `location` enviado.

**Frontend**
- `customer-form.util.ts` (`emptyCustomerFormValues`, `toCustomerFormValues`, `toCustomerInput`) é usado pelo formulário administrativo (`use-customer-form.hook.ts`) **e** pelo passo de entrega do checkout (`use-customer-delivery-form.hook.ts`). Um único ajuste ali cobre as duas telas sem mapa.
- `useMyCustomer()` já compartilha o cadastro com o checkout: o `save` atualiza o estado com `name`/`email` da sessão.
- `store-location-map.component.tsx` usa `@vis.gl/react-google-maps` (`APIProvider`, `Map` não controlado com câmera inicial, `AdvancedMarker` arrastável, `onClick`, `onDragEnd`) e o botão "Localizar endereço no mapa". `store-location-field.component.tsx` escolhe entre o mapa real e `store-location-mock.component.tsx` e encadeia `window.gm_authFailure`.
- `store-location.util.ts` mistura configuração do Google Maps com regras da loja, e a constante de casas se chama `STORE_COORDINATE_DECIMALS`.
- `storefront.mock.ts` define `ZONES` com `store`, `city` e `state` (sem slug). `AccountControl` mostra "Conta do escritório" fixo para não administradores.
- A spec `auth/storefront-access` está desatualizada ("olá, <primeiro nome>" e "sair" como texto); o delta corrige só o requisito do controle de conta.

## Goals / Non-Goals

**Goals:**
- Gravar o ponto do cliente sem quebrar nenhum consumidor atual de `/me/customer` e `/customers/:id`, que não conhece o campo.
- Um único componente de mapa do cliente que reaproveita a infraestrutura do mapa da loja, sem acoplar clientes a lojas no domínio.
- Deixar a sugestão sempre sob controle do usuário: nada muda nos campos sem um clique explícito.

**Non-Goals:**
- Tornar o ponto obrigatório ou validar a coerência entre o ponto e o texto do endereço (o aviso de ponto desatualizado é só visual).
- Guardar a sugestão ou o endereço formatado do provedor no cadastro.
- Cache ou limite das chamadas de geocodificação.
- Mudar as mensagens "olá, <primeiro nome>" que ainda aparecem em `auth/storefront-access` ("Criar conta pela loja…"), `orders/checkout-access`, `admin/admin-area` e `shared/design-system`: ficam para uma revisão de specs separada.

## Decisions

### 1. Três etapas sequenciais com contexto limpo
Negócio → Backend → Frontend, cada uma em um subagente.
- O backend depende do build de `@jaja/customers` e `@jaja/stores`.
- O frontend depende de `GET /geocoding/reverse`, `GET /storefront/stores` e do ponto em `/me/customer`.

A conferência com o Google Maps real (as duas chaves) é repetida na conversa principal, com o usuário.

### 2. `CustomerLocation` no pacote de clientes, repetindo as regras do `GeoPoint`
`@jaja/customers` não importa `@jaja/stores`, e o cliente não deve depender do modelo de loja. O VO repete limites, arredondamento e −0 → 0, e falha com **um** código (`CUSTOMER_LOCATION_INVALID`) em vez de um por coordenada. Para o usuário, o ponto é uma coisa só; o frontend mostra um erro geral acima do mapa.
- Alternativa: extrair um `GeoPoint` para `packages/shared`. Rejeitada porque a change não altera `packages/shared`, e a duplicação é pequena e coberta por testes.

### 3. Ponto dentro de `CustomerAddress`, em colunas próprias da tabela
O ponto é parte do endereço (substituído junto, comparado em `equals`), então fica em `address.location` no DTO. No banco ficam `customers.latitude`/`longitude` `Float?`, como em `stores`, mais a constraint `customers_location_both_or_none`.
- Alternativa: JSON em uma coluna. Rejeitada porque as regras de cobertura dos próximos prompts vão filtrar por coordenadas em SQL.

### 4. Regra de preservação no `SaveCustomer`, com `undefined` ≠ `null` de ponta a ponta
No `update`, a localização efetiva é `input.address.location === undefined ? existing.address.location : input.address.location`, e o endereço é montado com ela. Criação trata `undefined` e `null` como sem ponto. Para a diferença chegar ao domínio:
- `customer-http.ts#toInput` repassa `address.location` exatamente como veio (sem `?? null`);
- no frontend, `toCustomerInput` envia o valor do formulário como está: o checkout e o admin recebem o ponto do cadastro em `toCustomerFormValues` e o devolvem; um formulário vazio não tem `location` e não envia o campo.

Alternativas:
- `PATCH` só para o ponto. Rejeitada porque "Minha conta" salva tudo de uma vez e o `PUT` já substitui o endereço.
- Exigir `location` em todo `PUT`. Rejeitada porque quebraria clientes da API que não conhecem o campo.

### 5. `reverseGeocode` no mesmo provedor, devolvendo o ponto consultado
O `GeocodingProvider` ganha `reverseGeocode(point)` e valida o ponto com `GeoPoint.tryCreate`, falhando com `GEOCODING_LOCATION_INVALID`. O DTO devolve as coordenadas consultadas, e não as do resultado, porque o marcador é a verdade do usuário e a sugestão só descreve o entorno.
- No Google, `geocode` e `reverseGeocode` passam a usar um método privado com `fetch`, timeout, status e log (`request(params)`). Cada método só monta os parâmetros e mapeia o primeiro resultado.
- `result_type=street_address|premise|route` evita sugestões de bairro ou cidade inteiros.
- O mapeamento de componentes tem ordem de fallback fixa (bairro: `sublocality_level_1` → `sublocality` → `neighborhood`; cidade: `administrative_area_level_2` → `locality`). Componentes fora do formato viram `null`, e o frontend nunca sobrescreve com lixo.

O controller converte `latitude`/`longitude` com `Number()` depois de rejeitar ausente e vazio (`Number('')` é 0), e responde `400` antes de chamar o provedor. A rota `reverse` é um método próprio declarado no mesmo controller.

### 6. Geocodificação aberta a usuários autenticados, e não pública
`@AdminOnly()` sai da classe e entra `@UseGuards(JwtGuard)`. Exigir token mantém um mínimo de controle de uso da cota do Google sem criar limite por usuário (fora do escopo). A chave continua só no servidor. O delta de `admin/admin-api-authorization` acompanha a mudança.

### 7. Lojas da vitrine por query CQRS pública, casadas pelo slug
`FindStorefrontStoresQuery` (interface no pacote) implementada como atributo `findStorefrontStores` do `StorePrisma`, com `SELECT` explícito dos campos públicos, `is_active AND deleted_at IS NULL` e `NAME_ORDER`. `StorefrontStoreController` (`storefront/stores`, sem guard) chama a query direto, como o catálogo. No frontend, `ZONES` ganha `storeSlug`, e a página casa a loja da vitrine com `findBySlug`. O slug é estável e único, enquanto o nome pode mudar.
- Alternativa: abrir `GET /stores` a todos. Rejeitada porque expõe telefone e status e mistura a API administrativa com a vitrine.

### 8. Infra do Google Maps em `src/shared/maps`
`google-maps.config.ts` recebe `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_MAP_ID`, `isGoogleMapsConfigured`, `COORDINATE_DECIMALS` (antes `STORE_COORDINATE_DECIMALS`) e `roundCoordinate`. `use-google-maps-load-failure.hook.ts` devolve `loadFailed` e `handleLoadError`, encadeando `gm_authFailure` ao anterior e restaurando no unmount. Lojas e clientes importam dali, e `store-location.util.ts` fica só com raio e ponto simulado da loja. Os módulos não se importam entre si para a infraestrutura.
- Exceção aceita: o mapa do cliente usa `reverseGeocode`/`geocodeAddress` e `useStorefrontStores` de `modules/stores/data`, e reaproveita a ilustração `/images/store-map-mock.svg`. São dados de lojas, não infraestrutura.

### 9. `CustomerAddressMap` controlado pelo formulário, com estado local só para o fluxo
O ponto vive em `address.location` do React Hook Form (`setValue` com `shouldDirty`), para "Salvar"/"Descartar" funcionarem sem código extra. O componente guarda localmente:
- `suggestion` (`idle | loading | found | not-found`);
- o texto de "Endereço encontrado";
- uma **âncora**: os campos de endereço (sem complemento) no momento em que o ponto foi marcado, localizado ou a sugestão foi aplicada.

O aviso de ponto desatualizado compara `useWatch` desses campos com a âncora. A âncora nasce `null` para um ponto vindo do cadastro, e o aviso só aparece depois de uma ação no mapa nesta visita, como diz a spec.

Descarte de resposta atrasada: um contador de requisição (`useRef`) incrementado a cada clique ou fim de arraste. A resposta só é aplicada se o seu número ainda for o atual.

Câmera: mapa não controlado com `defaultCenter`/`defaultZoom` calculados uma vez (ponto do cliente com zoom de rua, loja com zoom de bairro, Paulista). "Localizar" move a câmera com `map.panTo`/`setZoom`, como no mapa da loja. As coordenadas da loja chegam de forma assíncrona, então o mapa só é montado depois de `useStorefrontStores` terminar de carregar, para não abrir na Paulista e pular.

### 10. Página na mesma URL para todos os estados, como o checkout
`MyAccountPage` segue o `CheckoutGate`:
- sem sessão, `AuthForm` com título próprio;
- com sessão, `useMyCustomer()`.

O formulário é montado só depois do carregamento, com `defaultValues` definitivos, o que evita `reset` na montagem. `useMyAccountForm` faz `reset(toCustomerFormValues(saved))` depois de salvar, para "Salvar dados" voltar a ficar desabilitado. A rota usa `<Suspense>` porque `useStorefront` lê `useSearchParams`.

### 11. Todas as lojas no mapa, com o raio informativo, e a câmera na loja selecionada
O mapa do cliente mostra o marcador e o círculo de atendimento de **todas** as lojas ativas, e não só da loja da vitrine: o usuário precisa saber quais lojas existem e até onde cada uma atende antes de marcar o ponto. `GET /storefront/stores` já devolve todas as lojas ativas com ponto e `deliveryRadiusMeters`, e `useStorefrontStores` já as carrega, então isso é só desenho.
- **Câmera continua na loja selecionada** (ou no ponto do cliente), sem enquadrar todas as lojas: as duas lojas do seed estão a ~360 km uma da outra, e um zoom que cubra as duas é inútil para marcar a porta de entrada.
- **Navegação explícita para as outras lojas** (correção depois do primeiro uso: só desenhar as lojas não bastou — com zoom de bairro, a loja de outra cidade fica fora da tela e o usuário conclui que ela não existe). Cada item da lista tem "Ver no mapa" (câmera naquela loja, com zoom de bairro) e a lista tem "Ver todas as lojas" (`fitBounds` com todas as lojas e o ponto do cliente). Nenhuma das duas toca no ponto nem pede sugestão: navegar no mapa não é marcar endereço. A lista também mostra o endereço de referência de cada loja, que já vem da API, para a informação não depender do mapa. No mapa simulado as ações não aparecem, porque não há câmera.
- **Lista abaixo do mapa** com o nome e o raio de cada loja, com a selecionada indicada. Ela resolve o que o mapa não resolve: loja fora da área visível e mapa simulado (sem chave pública), que não desenha marcadores nem círculos.
- **Círculos read-only**, desenhados com `google.maps.Circle` pelo mesmo caminho do mapa do cadastro de loja (`useMap` + instância imperativa), mas sem `editable`/`draggable`. Clicar no círculo ou no marcador da loja marca o ponto do cliente ali, como um clique no mapa, para o círculo não virar uma área morta sobre o mapa.
- **O raio é só informação nesta entrega:** nada é bloqueado nem sugerido a partir da posição do ponto. Validar cobertura, escolher a loja que atende e liberar o pedido continuam nos próximos prompts, e é lá que o raio deixa de ser decorativo.
- Alternativa considerada: só a loja selecionada, como estava. Rejeitada porque o usuário não descobre as outras lojas e não enxerga a área de atendimento, que é justamente o que dá sentido ao ponto.

## Risks / Trade-offs

- [Um formulário do checkout ou do admin aberto antes de o ponto ser marcado em outra aba devolve o ponto antigo e o sobrescreve] → Aceito: é o mesmo comportamento de "último a salvar vence" dos demais campos, e o caso é raro. A regra de preservação resolve o caso comum (telas que nunca viram o ponto).
- [Abrir a geocodificação a qualquer usuário aumenta o consumo da cota do Google] → Exige token, a sugestão só é pedida no clique e no fim do arraste, e o limite por usuário fica registrado como fora do escopo.
- [Geocodificação reversa do Google pode devolver um número vizinho ou nenhum número] → O marcador não se move, o usuário decide se usa, e a falta de número gera o texto "Confira o número depois de usar o endereço.".
- [A extração para `src/shared/maps` pode quebrar o cadastro de loja] → Só mudam imports e o nome da constante de casas, e há validação manual do cadastro de loja com o mapa real e o simulado.
- [O círculo de atendimento pode ser confundido com uma regra ativa ("posso pedir")] → O texto da lista e do mapa diz que é a área de atendimento da loja, e nada é bloqueado; a regra de verdade vem no próximo prompt.
- [`ZONES` e o seed de lojas podem divergir de slug] → O mapa cai no ponto da Paulista quando `findBySlug` não encontra a loja, sem erro. O comentário de `ZONES` passa a citar o slug do seed.
- [Clientes do seed ficam em Fortaleza, fora do raio das lojas de SP e RJ] → Irrelevante nesta entrega (nenhuma regra usa o ponto). O mapa abre na loja da vitrine, não no endereço.

## Migration Plan

1. Migration `customers_location`: `ALTER TABLE customers ADD COLUMN latitude DOUBLE PRECISION, ADD COLUMN longitude DOUBLE PRECISION` mais `CHECK ((latitude IS NULL) = (longitude IS NULL))`. As colunas são anuláveis e sem default, e os clientes existentes ficam sem ponto, sem backfill.
2. O deploy do backend antes do frontend é seguro: `location` é opcional na entrada e aditivo na saída. O frontend antigo continua funcionando, já que não envia `location` e o ponto é preservado.
3. Rollback: reverter o frontend e o backend; a migration pode ficar (colunas nulas não afetam o código antigo) ou ser revertida removendo a constraint e as colunas, com perda dos pontos gravados.
4. Depois do archive, atualizar à mão o `## Purpose` de `openspec/specs/stores/address-geocoding/spec.md`, que hoje diz que a geocodificação é "restrita a administradores" e usada só pelo cadastro de lojas (deltas não alteram o propósito).
