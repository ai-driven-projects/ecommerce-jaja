## Why

A loja pública ainda mostra um catálogo inventado. A vitrine (`/`) e o detalhe (`/p/[slug]`) usam 26 produtos fictícios do frontend, com emoji no lugar de foto e ficha técnica e estoque inventados. O banco já tem o catálogo real da Kalunga: 1.076 produtos com fotos, 1.111 categorias em três níveis e 210 marcas. Mas todos os endpoints do catálogo são administrativos, então a loja não tem como lê-los. Esta change liga a loja ao catálogo real, com destaques, categorias, busca textual e filtros, e deixa o carrinho para uma entrega seguinte.

## What Changes

- **Produto em destaque:**
  - o produto ganha o atributo `isFeatured` (padrão `false`), editável no formulário do admin (checkbox "Destaque na vitrine", também na criação) e sinalizado na lista do admin;
  - a carga inicial marca como destaque os 24 produtos disponíveis com mais avaliações na Kalunga (4 estrelas ou mais e 10 avaliações ou mais). O CLI calcula isso a partir dos dados já raspados e grava o campo no `products.json`.
- **API pública do catálogo (`/storefront`)**, só leitura e sem token:
  - `GET /storefront/categories`: árvore das categorias ativas que têm produtos visíveis, com a contagem de produtos;
  - `GET /storefront/products`: lista paginada (24 por página, até 48) com busca textual em nome, código, marca, categorias e descrição, e com filtros por categoria (incluindo as subcategorias), marca, faixa de preço, ofertas e destaques. Tem seis ordenações (relevância, destaques, menor preço, maior preço, nome e maior desconto) e a contagem de produtos por marca para os filtros;
  - `GET /storefront/products/:slug`: detalhe com todas as imagens, a trilha de categorias, a marca e o percentual de desconto;
  - só aparecem produtos ativos cuja categoria e as ancestrais estejam ativas. Marca inativa não esconde o produto.
- **Leitura em CQRS:** as consultas são interfaces no módulo `catalog`, implementadas no adapter Prisma com a regra no SQL e chamadas direto pelo controller, sem caso de uso nem entidade.
- **Busca textual:**
  - `products` ganha uma coluna gerada com o documento de busca do próprio produto (nome, código e descrição), com índice GIN;
  - marca e categorias entram no documento na hora da consulta.
- **Vitrine (`/`):**
  - chips com as 12 categorias principais e, abaixo, as subcategorias da escolhida;
  - página inicial com "Em destaque", "Ofertas da semana" e "Categorias em destaque";
  - a busca do cabeçalho passa a funcionar;
  - listagem com filtros laterais (ou em painel no celular), ordenação, filtros ativos removíveis e paginação;
  - todo esse estado fica na URL, com parâmetros em português (`categoria` passa a ser o slug real);
  - os cards mostram a foto real, com emoji por categoria como reserva, e deixam de exibir o "+" do carrinho.
- **Detalhe (`/p/[slug]`):**
  - lido da API no servidor, com 404 para produto inexistente ou não visível;
  - galeria com todas as imagens, setas, contador e miniaturas;
  - trilha de categorias, marca, código, preço "De:" e desconto, descrição com "Ler mais", ficha (marca, categoria, código e unidade) e produtos da mesma categoria;
  - o botão "Adicionar" aparece, mas só exibe um aviso e não altera o carrinho;
  - saem o estoque, a ficha técnica e as fotos em emoji inventados.
- **Design:** `apps/frontend/DESIGN.md` passa a usar foto real do produto e documenta a listagem, a busca e a galeria.
- **BREAKING:** o parâmetro `categoria` da vitrine deixa de aceitar as cinco categorias inventadas (`papelaria`, `impressão`…) e passa a receber o slug de uma categoria real. Links antigos com esses valores caem numa listagem vazia.
- **Fora do escopo:**
  - carrinho com produtos reais: o `cart.context.tsx`, a gaveta e o checkout continuam usando o mock;
  - bairros, lojas, ETA e entregadores, que continuam simulados;
  - estoque, avaliações, autocomplete, tolerância a erros de digitação e sinônimos;
  - SEO além de title, description e Open Graph do detalhe;
  - integrar o dashboard `/admin/catalog` à API.

## Capabilities

### New Capabilities

- `catalog/storefront-api`: endpoints públicos de leitura do catálogo para a loja: regra de visibilidade, árvore de categorias com contagem, listagem paginada com busca textual, filtros, ordenações e facetas de marca, e detalhe de produto por slug.

### Modified Capabilities

- `catalog/storefront`:
  - o catálogo local é substituído pelo catálogo da API, com seções na página inicial e categorias reais;
  - a categoria na URL passa a ser um slug, e entram os parâmetros de busca, filtros, ordenação e página;
  - o placeholder do detalhe dá lugar ao detalhe real com galeria;
  - o botão "Adicionar" do detalhe não altera o carrinho.
- `catalog/product-registration`: o produto ganha `isFeatured` (criação, alteração e listagem administrativa), e a carga inicial marca os 24 destaques por avaliação.
- `catalog/product-admin`: o formulário ganha "Destaque na vitrine" na seção Publicação, visível também na criação, e a lista exibe o badge "Destaque".
- `shared/design-system`:
  - a imagem do produto passa a ser a foto real, com a ilustração da categoria como reserva;
  - o card de produto passa a exibir a foto, o selo de desconto ou de destaque e o nome limitado a três linhas;
  - o campo de busca da loja passa a buscar de fato.

## Impact

- `modules/catalog`:
  - `isFeatured` na entidade, nos DTOs, no `save-product.use-case`, no mock in-memory e nos testes;
  - novos DTOs e interfaces de query da vitrine em `src/product/{dto,provider}` e `src/category/{dto,provider}`, sem casos de uso de leitura.

  Backend, CLI e frontend dependem de `npm run build --workspace=@jaja/catalog`.
- `apps/backend`:
  - banco: `prisma/models/catalog.model.prisma` e a migration `catalog_product_storefront`, com `is_featured` e a coluna gerada `search_document` com índice GIN;
  - catálogo: `product.prisma.ts` e `category.prisma.ts` (queries da vitrine em SQL), `storefront.controller.ts` (novo), `catalog.module.ts` e `product.controller.ts` (`isFeatured`);
  - seed e testes: `prisma/seed/tasks/catalog-products.seed.ts`, `prisma/seed/data/products.json` (regenerado) e `src/modules/catalog/test/storefront.integration.http`;
  - API nova e pública: `GET /storefront/categories`, `GET /storefront/products` e `GET /storefront/products/:slug`.
- `apps/cli`: `src/commands/scrape/kalunga/seed/{products,types}.ts` e `seed.test.ts`, com a regra dos destaques.
- `apps/frontend`:
  - loja: `src/modules/catalog/{data,components,pages,index.ts}`, com `storefront.api.ts`, os utilitários e hooks da vitrine, a listagem, a home, a galeria e o detalhe;
  - rotas: `src/app/(public)/p/[slug]/page.tsx`;
  - componentes compartilhados: `src/shared/components/store/*`, com `ProductArt` com foto, `ProductCard`, `StorefrontSearch`, `StorefrontHeader`, `store.types.ts` e o novo `category-art.ts`;
  - admin: `product.api.ts`, `product.schema.ts`, `use-product-form.hook.ts`, `product-form.component.tsx` e `product-list.component.tsx`;
  - `DESIGN.md`.
- Imagens remotas de `img.kalunga.com.br`, já liberadas no `next.config.ts`.
- Coordenação com as changes em andamento:
  - `cadastro-loja` altera os requisitos "Catálogo com dados locais" e "Bairro não atendido" de `catalog/storefront`. Esta change remove o primeiro e mantém os bairros agrupados por loja no requisito que o substitui;
  - nenhuma das duas toca as queries do catálogo.
