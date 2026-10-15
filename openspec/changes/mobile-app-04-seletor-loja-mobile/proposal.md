## Why

O app mobile já tem núcleo, tema, cliente HTTP, DI e o shell de abas (etapas 1 a 3), mas ainda não conhece nenhum dado do backend. Esta é a etapa 4 de 15 do loop `mobile-app` e abre a fase Catálogo pelo primeiro domínio, `store`: a vitrine web mostra no cabeçalho a loja em que a pessoa compra, lembra a escolha entre visitas e usa a cidade/UF dessa loja para pré-preencher os dados de entrega. O app precisa da mesma escolha antes da home (etapa 5) e do checkout/dados de entrega (etapas 11 e 12).

## What Changes

- Domínio `store` (Dart puro): entidade `Store` com os campos de `StorefrontStoreDTO`, cidade/UF lidas do fim do endereço de referência (o mesmo paliativo de `storePlaceOf` do web), a regra de qual loja vale (lembrada, se ainda ativa; senão a primeira ativa) e o contrato do repositório.
- Infraestrutura: DTO escrito à mão de `GET /storefront/stores` com teste de parsing, repositório que busca as lojas (guardando a lista da sessão do app, como o web faz por aba) e lembra o slug escolhido em `shared_preferences`; armazenamento indisponível ou ilegível conta como "sem escolha".
- UI: seletor em pílula no topo da aba Início ("Loja Paulista · São Paulo/SP") que abre um bottom sheet "Comprar na loja" com as lojas ativas e a atual marcada; com uma loja só, a pílula fica estática. Estados uniformes: skeleton enquanto carrega, banner de erro com "Tentar de novo" e vazio com uma ação. A escolha **não** muda o catálogo nem vira parâmetro de API.
- Primeiro ViewModel do app: entra `watch_it` (com a barreira estendida para que ele só apareça em `lib/ui` e `lib/app`, sem expor o localizador às telas), `freezed` nas entidades e o padrão de registro de ViewModels na DI que as próximas etapas seguem.
- Widget tests dos estados e da troca de loja; testes de unidade da regra de escolha, do DTO, do armazenamento e do repositório com `dio` fake.

## Capabilities

### New Capabilities
- `mobile/mobile-store`: lista das lojas ativas, escolha da loja em vigor lembrada no aparelho, seletor e seus estados.

### Modified Capabilities
- `mobile/mobile-architecture`: acrescenta o requisito de confinamento do pacote de ligação da UI (`watch_it`); os requisitos existentes não mudam.

## Impact

- **Código:** só `apps/mobile/**` — `lib/modules/store/`, `lib/core/value_objects/`, `lib/infra/{api,storage,store,di}/`, `lib/ui/modules/store/`, a `HomePage` e o router, `CLAUDE.md`, `pubspec.yaml`/`pubspec.lock` e `test/**`.
- **Dependências:** `watch_it`, `shared_preferences` e `freezed_annotation`; dev `freezed` (via `flutter pub add`).
- **API:** só `GET /storefront/stores`, sem token; nenhum parâmetro novo em outra chamada.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
