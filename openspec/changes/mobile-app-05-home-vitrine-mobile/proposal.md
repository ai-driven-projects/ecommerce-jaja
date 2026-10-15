## Why

O app já escolhe e lembra a loja (etapa 4), mas a aba Início ainda é uma página provisória: o cliente não vê nenhum produto. Esta é a etapa 5 de 15 do loop `mobile-app` e abre o domínio `catalog`, que as etapas 6 (busca) e 7 (detalhe) estendem: a página inicial da vitrine web (`catalog/storefront`, "Página inicial da vitrine") mostra as categorias, "Em destaque", "Ofertas da semana" e "Categorias em destaque" a partir da API pública, e o app precisa do mesmo conteúdo, com os padrões de app do plano.

## What Changes

- Domínio `catalog` (Dart puro): entidades `Category` (árvore), `ProductSummary` (card da listagem, preços em `Money`), `ProductPage` com facetas de marca, `ProductQuery` com as ordenações de `STOREFRONT_PRODUCT_SORTS`, a codificação única dos filtros (os nomes dos parâmetros da API, usados tanto na chamada quanto nas rotas do app), as consultas da Início (12 destaques, 8 ofertas por desconto, até 12 categorias em destaque em pré-ordem) e o contrato do repositório.
- Infraestrutura: DTOs escritos à mão de `GET /storefront/categories` e `GET /storefront/products` com testes de parsing a partir do JSON do seed, repositório que guarda a árvore de categorias enquanto o app está aberto (como as lojas) e nunca guarda produtos.
- Aba Início: o seletor de loja continua no topo; abaixo, a linha de chips das categorias raiz ("Tudo" + raízes com emoji), um hero compacto da marca (sem os dados fictícios do web), "Em destaque" e "Ofertas da semana" em trilhos horizontais de cards, e a grade "Categorias em destaque". Cada bloco remoto tem skeleton, banner com "Tentar de novo" que refaz só ele, e some quando vazio; tudo vazio vira um estado vazio único com "Ver catálogo"; puxar a tela refaz tudo, inclusive as lojas.
- Navegação: chips, "Ver tudo →" e cartões de categoria abrem a aba Buscar com o filtro na URL (`/search?category=…`, `featured=true`, `onSale=true&sort=discount`); o card abre a rota de produto (`/home/product/<slug>`), provisória até a etapa 7. A página Buscar recebe o filtro decodificado, mas segue provisória até a etapa 6.
- Fotos do catálogo com `cached_network_image` no `ProductArt`, com a barreira estendida (regra F: o pacote só em `lib/ui`). Mapa de emoji e tom pastel por categoria raiz copiado de `category-art.ts`.
- Testes de unidade (entidades, codificação dos filtros, DTOs, repositório com `dio` fake, ViewModel com repositório fake) e widget tests dos blocos, dos estados e da navegação.

## Capabilities

### New Capabilities
- `mobile/mobile-catalog`: categorias e produtos da vitrine no app, codificação dos filtros, categorias em destaque e ilustração de reserva por raiz.
- `mobile/mobile-home`: conteúdo, estados e navegação da aba Início.

### Modified Capabilities
- `mobile/mobile-navigation`: acrescenta as rotas do catálogo (Buscar com filtros na URL e a rota de produto na pilha de Início); os requisitos existentes não mudam.
- `mobile/mobile-design-system`: o card de produto passa a carregar a foto pelo cache de imagens do aparelho ("Card de produto").
- `mobile/mobile-architecture`: acrescenta o confinamento do pacote de imagens de rede a `lib/ui`; os requisitos existentes não mudam.

## Impact

- **Código:** só `apps/mobile/**` — `lib/modules/catalog/`, `lib/infra/{api,catalog,di}/`, `lib/ui/modules/catalog/`, `lib/ui/shared/{widgets/product_art.dart,formatters/}`, `lib/app/router/`, `CLAUDE.md`, `pubspec.yaml`/`pubspec.lock` e `test/**`.
- **Dependências:** `cached_network_image` (via `flutter pub add`).
- **API:** `GET /storefront/categories` e `GET /storefront/products` (públicos, sem token), com os parâmetros que o controller já aceita; nenhum parâmetro novo.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
