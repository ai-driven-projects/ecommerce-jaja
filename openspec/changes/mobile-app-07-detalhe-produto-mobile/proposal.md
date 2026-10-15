## Why

A Início (etapa 5) e a Buscar (etapa 6) já abrem a rota do produto, mas ela ainda mostra a página provisória "Produto": o cliente vê o card e não consegue ver as fotos, o preço nem a descrição. Esta é a etapa 7 de 15 do loop `mobile-app` e fecha a fase Catálogo: o detalhe da vitrine web (`p/[slug]`, `product-detail.component.tsx` e `product-gallery.component.tsx`, specs `catalog/storefront` "Navegação para o detalhe do produto" e "Galeria de imagens do produto") precisa existir no app, seguindo o mockup `Produto.dc.html`, com uma ação principal por tela.

## What Changes

- Domínio `catalog`: entidade do detalhe (`ProductDetail` com marca, trilha de categorias e imagens ordenadas), a consulta de "Mais de <categoria>" e o contrato `fetchProduct(slug)` no repositório.
- Infraestrutura: DTO escrito à mão de `GET /storefront/products/:slug` com teste de parsing a partir de JSON de exemplo; o repositório pede o produto com o slug codificado e nunca o guarda; `404` vira "não encontrado".
- Página do produto no lugar da provisória, nas duas pilhas (Início e Buscar): galeria de fotos deslizável com contador e miniaturas, selos "Em destaque" e `−N%`, marca, nome, unidade e código, preço com o "De:" riscado, trilha de categorias, "Sobre o produto" com "Ler mais"/"Ler menos", ficha (marca, categoria, código, unidade) e "Mais de <categoria>" com até 4 produtos.
- Ação principal "Adicionar ao carrinho" fixa no rodapé, visível e desabilitada até a etapa 9 ligar o carrinho.
- Estados: skeleton na carga, banner com "Tentar de novo" na falha, e produto inexistente como estado vazio com "Voltar ao catálogo".
- `ProductArt` ganha os tamanhos da galeria e da miniatura (área que preenche o pai, emoji maior), sem mudar o card.
- Testes de unidade (entidade, DTO, repositório com `dio` fake, ViewModel com repositório fake) e widget tests da galeria, da descrição, da página, dos estados e das rotas.

## Capabilities

### New Capabilities
- `mobile/mobile-product`: conteúdo, galeria, estados e ações da página do produto no app.

### Modified Capabilities
- `mobile/mobile-catalog`: acrescenta a leitura do detalhe do produto por slug; os requisitos existentes não mudam.
- `mobile/mobile-navigation`: "Rotas do catálogo" passa a abrir a página do produto (não mais a provisória) nas duas pilhas.

## Impact

- **Código:** só `apps/mobile/**`: `lib/modules/catalog/`, `lib/infra/{api,catalog,di}/`, `lib/ui/modules/catalog/`, `lib/ui/shared/{widgets/product_art.dart,theme/app_typography.dart}`, `lib/app/router/`, `CLAUDE.md` e `test/**`.
- **Dependências:** nenhuma nova.
- **API:** `GET /storefront/products/:slug` (público, sem token) e `GET /storefront/products`, já usado; nenhum parâmetro novo.
- **Sem impacto** em `apps/backend`, `apps/frontend`, `modules/*`, `packages/*` nem em specs de outros domínios.
