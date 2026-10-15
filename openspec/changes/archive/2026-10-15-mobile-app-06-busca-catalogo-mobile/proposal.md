## Why

A Início (etapa 5) já abre a aba Buscar com um filtro na rota (categoria, destaques, ofertas), mas a aba ainda é uma página provisória: o cliente não consegue procurar um produto nem refinar o catálogo. Esta é a etapa 6 de 15 do loop `mobile-app`: a listagem da vitrine web (`catalog/storefront`, "Busca de produtos pelo cabeçalho" e "Listagem com filtros, ordenação e paginação na URL", implementada em `storefront-query.util.ts`, `use-storefront-products.hook.ts`, `storefront-listing.component.tsx` e `storefront-filters.component.tsx`) precisa existir no app, com os padrões de app do plano: filtros em painel inferior e paginação infinita no lugar dos botões de página.

## What Changes

- Regras puras da listagem no domínio `catalog`: 24 itens por página (o `LISTING_PAGE_SIZE` do web), ordem efetiva (relevância com busca, destaques sem; "Mais relevantes" só com busca), normalização do filtro (busca aparada, marcas sem repetição e no máximo 20), "tem filtros" e "limpar filtros", e o caminho de uma categoria na árvore (para o título) e a árvore achatada (para o painel).
- Conversão do preço digitado em reais para centavos e de volta (`parseReaisToCents`/`formatCentsAsReais` do web).
- Aba Buscar de verdade: campo de busca com espera de 300 ms (Enter aplica na hora, botão limpa), título e contagem, botão "Filtros (n)" que abre o painel inferior (categoria, marca com contagem, faixa de preço com "Aplicar", só ofertas, só destaques), painel de ordenação com as opções de `STOREFRONT_PRODUCT_SORTS`, pílulas removíveis dos filtros ativos com "Limpar filtros", grade de duas colunas com paginação infinita por `page`/`pageSize`.
- Estados uniformes: skeleton da grade na primeira página (também ao trocar o filtro), banner com "Tentar de novo" (na grade ou só no rodapé, se a falha for da página seguinte) e "Nada por aqui. Já já." com uma ação.
- O filtro em vigor é espelhado na rota da aba (`/search?…`), que continua sendo a entrada vinda da Início; o produto aberto da Buscar fica na pilha da própria aba (`/search/product/<slug>`, com a página provisória até a etapa 7).
- Testes de unidade das regras novas, do ViewModel com repositório fake (espera da busca, troca de filtro reinicia a página e descarta resposta velha, fim da lista, falha da página seguinte) e widget tests da página, do painel e das rotas.

## Capabilities

### New Capabilities
- `mobile/mobile-search`: busca, filtros, ordenação, paginação infinita e estados da aba Buscar.

### Modified Capabilities
- `mobile/mobile-navigation`: "Rotas do catálogo" passa a ter a Buscar real (filtro espelhado na rota) e o produto também na pilha da Buscar.

## Impact

- **Código:** só `apps/mobile/**` — `lib/modules/catalog/model/`, `lib/ui/modules/catalog/{pages,widgets,view_models}/`, `lib/ui/shared/formatters/`, `lib/app/router/`, `lib/infra/di/`, `CLAUDE.md` e `test/**`.
- **Dependências:** nenhuma nova.
- **API:** só `GET /storefront/products` e `GET /storefront/categories`, já usados, com os parâmetros que o controller aceita; nenhum parâmetro novo.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
