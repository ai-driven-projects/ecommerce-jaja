## Context

A motivação e o escopo estão em `proposal.md`. O comportamento está nas specs desta change: `catalog/storefront-api`, `catalog/storefront`, `catalog/product-registration`, `catalog/product-admin` e `shared/design-system`. O roteiro de implementação detalhado é o prompt `openspec/extras/prompts/12-vitrine-catalogo.md`. Este é o estado atual relevante.

**Domínio (`modules/catalog`)**
- Os agregados `brand`, `category` e `product` já existem, com `find-*.query.ts` em `provider/` e DTOs em `dto/`.
- `Product` não tem destaque. `Category` já tem `isHighlighted` e `order`, e `CATEGORY_MAX_DEPTH = 3`.
- Nenhum agregado tem caso de uso de leitura: os controllers chamam as queries do adapter diretamente.

**Backend**
- Todos os controllers do catálogo são `@AdminOnly()`. Não há guard global, então um controller sem `@AdminOnly()` e sem `JwtGuard` já é público.
- `BrandPrisma.findBrands` e `CategoryPrisma` fazem a busca em SQL cru (`$queryRaw`) com um `SEARCH_DOCUMENT` montado na consulta, `folded`/`toPrefixTsQuery` de `src/db/text-search.sql.ts`, `ts_rank` e `COLLATE "pt-BR-x-icu"`.
- `ProductPrisma.findProducts` (admin) é a exceção:
  - usa o client do Prisma com `contains`;
  - carrega a árvore de categorias em memória para calcular descendentes e `categoryPath`.
- Não há índice GIN nem coluna `tsvector` no banco. As descrições dos produtos somam cerca de 790 mil caracteres.

**Seed e CLI**
- `products.json` é gerado pelo CLI (`scrape:seed`) a partir de `apps/cli/data/kalunga`, e o backend nunca lê o CLI.
- Os dados raspados têm `rating { stars, count }`: 285 dos 1.076 produtos têm avaliação. Hoje o CLI descarta esse campo.

**Frontend**
- **Dados fictícios:** a vitrine (`storefront.component.tsx`, `use-storefront.hook.ts`), o detalhe (`product-detail.component.tsx`, `p/[slug]/page.tsx`), o carrinho (`cart.context.tsx`, via `findProduct`) e o dashboard do catálogo leem `storefront.mock.ts`.
- **Componentes da loja:** ficam em `src/shared/components/store` e recebem `StoreProduct` (com `emoji`, sem foto). `ProductCard` já esconde o "+" quando não recebe `onChangeQuantity`.
- **Busca do cabeçalho:** `StorefrontSearch` existe, mas não faz nada.
- **Shell:** `StorefrontShell` é client (`useSearchParams`) e envolve todo o grupo `(public)`.
- **Imagens:** `next.config.ts` já libera imagens remotas.
- **Design:** `DESIGN.md` manda usar emoji no lugar de foto.

**Specs e changes em andamento**
- `shared/design-system` descreve uma versão anterior do visual (bordas de 2px, SVG por categoria) e já diverge do código.
- `cadastro-loja` e `cadastro-cliente` estão abertas.
  - `cadastro-loja` altera "Catálogo com dados locais" e "Bairro não atendido" de `catalog/storefront`.
  - As duas alteram o mesmo requisito de `admin/admin-api-authorization`.

## Goals / Non-Goals

**Goals:**
- Leitura pública do catálogo leve: interface no módulo, SQL no adapter, controller fino.
- Busca textual com relevância e resposta estável com o catálogo do seed, sem extensões novas no PostgreSQL.
- Estado da vitrine inteiro na URL, que pode ser compartilhado, recarregado e navegado com "voltar".
- Deixar o próximo passo (carrinho com produtos reais) só dependente de trocar a origem de `findProduct`.

**Non-Goals:**
- Reescrever `ProductPrisma.findProducts` (admin) para SQL: funciona e fica como está.
- Denormalizar marca e categoria no produto ou manter índices atualizados por gatilhos.
- Cache HTTP, ISR ou renderização da listagem no servidor.
- Corrigir a divergência antiga entre `shared/design-system` e o código fora dos requisitos tocados.

## Decisions

### 1. Três etapas sequenciais com contexto limpo
Negócio → Backend (inclui CLI e seed) → Frontend, cada uma em um subagente com contexto limpo, como pede o prompt. Backend e CLI consomem o `dist` de `@jaja/catalog`. O frontend precisa da API pública rodando e do seed com destaques para validar no navegador.

### 2. Leitura em CQRS: interface + SQL + controller, sem caso de uso
- **Contratos:** as três consultas (`FindStorefrontProductsQuery`, `FindStorefrontProductBySlugQuery`, `FindStorefrontCategoriesQuery`) são interfaces em `provider/`, com os DTOs em `dto/`.
- **Implementação:** atributos públicos tipados de `ProductPrisma` e `CategoryPrisma`.
- **Consumo:** `StorefrontController` normaliza os parâmetros HTTP e chama a query.
- **Onde fica a regra:** toda regra de leitura fica no SQL (visibilidade, hierarquia, busca, filtros, ordenação, facetas, contagens e `discount_percent`). O adapter só mapeia linhas para DTO e, nas categorias, aninha as linhas pelo `parentSlug`. Por serem interfaces sem lógica, as queries não têm teste unitário; o comportamento é coberto pelo `.http`.

Alternativas descartadas:
- **Casos de uso de leitura (`find-storefront-*.use-case.ts`):** só repassariam a chamada. Não há regra fora do SQL nem agregação de consultas distintas que os justifique.
- **Serviço de domínio para o percentual de desconto:** é um campo de projeção, calculável na mesma expressão SQL usada para ordenar.
- **Árvore de categorias em memória, como em `findProducts`:** traria para a aplicação uma regra que o `WITH RECURSIVE` resolve numa consulta.

### 3. Controller público separado em `/storefront`
- **Rotas:** a loja usa `GET /storefront/categories`, `GET /storefront/products` e `GET /storefront/products/:slug`, num controller sem guard.
- **Admin:** `/products`, `/categories` e `/brands` continuam administrativos e sem mudança de contrato, exceto `isFeatured`.
- **Delta de autorização:** esta change não altera `admin/admin-api-authorization`. O requisito "Endpoints não administrativos não mudam" trata do efeito da proteção nos endpoints existentes, e o acesso público dos novos endpoints fica declarado em `catalog/storefront-api`. Assim se evita um terceiro delta sobre o mesmo requisito que `cadastro-loja` e `cadastro-cliente` já alteram.

Alternativas descartadas:
- **Abrir `GET /products` sem token:** exporia produtos inativos, `sku`/ids de relações e o formato administrativo, e misturaria dois públicos no mesmo contrato.
- **Parâmetro `public=true` no controller admin:** proteção condicional por parâmetro é mais fácil de errar.

### 4. Visibilidade como fragmento SQL com três joins de categoria
- **Joins:** `products p JOIN categories c1 LEFT JOIN categories c2 LEFT JOIN categories c3`. A profundidade máxima de 3 é garantida pelo domínio, então três joins bastam para exigir que a categoria e as ancestrais estejam ativas e não excluídas.
- **Nomes da trilha:** os mesmos joins fornecem os nomes da categoria e das ancestrais, usados na busca e no detalhe.
- **Marca:** entra por `LEFT JOIN brands b` só quando ativa e não excluída.
- **Reúso:** o fragmento é uma constante única, reaproveitada pelas três queries, inclusive na contagem de produtos por categoria.

Alternativa descartada: `WITH RECURSIVE` também para a visibilidade de cada produto. É mais genérico, porém mais caro e desnecessário com a profundidade fixa. A recursão fica para descer a partir de uma categoria (Decisão 6).

### 5. Busca: coluna gerada com índice GIN + marca e categorias na consulta
- **Coluna gerada:** `products.search_document`, `tsvector GENERATED ALWAYS AS (...) STORED`, com peso A para nome e sku e peso C para a descrição, usando a expressão literal de `folded` (`lower(translate(...))`, imutável) e índice GIN.
- **Documento na consulta:** `p.search_document || setweight(<marca>, 'A') || setweight(<nomes de c1, c2 e c3>, 'B')`, com `@@ to_tsquery('simple', toPrefixTsQuery(search))` e `ts_rank` na ordem `relevance`. A expressão fica numa constante única.
- **Termos:** `toPrefixTsQuery` mantém a regra atual, com prefixos, E entre os termos e no máximo 10 termos.
- **Prisma:** o campo é mapeado como `Unsupported("tsvector")?`, com `@@index(type: Gin)`. A migration é criada com `--create-only` e editada à mão. Um segundo `migrate dev` confirma que não há diferença.

Alternativas descartadas:
- **Documento inteiro na consulta, como em `brand.prisma.ts`:** recalcularia o `tsvector` das descrições (cerca de 790 mil caracteres) a cada busca.
- **Coluna mantida pela aplicação ou por gatilhos com marca e categorias:** renomear uma marca ou categoria exigiria reescrever produtos de outro agregado.
- **Extensões `unaccent`/`pg_trgm`:** tolerância a erros e sinônimos estão fora do escopo, e `folded` já resolve acentos sem extensão.

### 6. Categorias da loja numa consulta recursiva
- **Consulta:** `findStorefrontCategories` desce das raízes com `WITH RECURSIVE` só por categorias ativas e não excluídas, de modo que a subárvore de uma inativa fica de fora. Ela calcula `level` e `parentSlug`, conta os produtos visíveis por categoria, soma as descendentes, descarta `productCount = 0` e ordena por `order`, nome e `id`.
- **Filtro `category`:** `findStorefrontProducts` resolve o slug para a categoria e suas descendentes com o mesmo tipo de CTE.
- **Adapter:** só aninha as linhas.

Alternativa descartada: JSON aninhado montado inteiro no SQL. A agregação recursiva de `children` em SQL é pouco legível, e o aninhamento por `parentSlug` não contém regra.

### 7. Contagem, página e facetas em consultas paralelas
- **Consultas:** `findStorefrontProducts` executa três consultas com a mesma base de filtros, em `Promise.all`:
  - `count`;
  - página com `LIMIT/OFFSET` e a imagem principal por `LEFT JOIN LATERAL`, sem N+1;
  - facetas, com todos os filtros exceto `brand`, `GROUP BY` marca, `LIMIT 30`.
- **Desempate:** a ordem sempre termina em `name COLLATE "pt-BR-x-icu", id`, para as páginas serem estáveis.
- **Desconto:** `discount_percent` é uma expressão única, usada no `SELECT` e na ordenação `discount` com `NULLS LAST`.

Alternativa descartada: uma consulta com `count(*) OVER ()` e facetas via `GROUPING SETS`. Seria mais difícil de manter, e o ganho é irrelevante nesse volume.

### 8. Destaque como atributo do produto, calculado no CLI para o seed
- **Atributo:** `isFeatured` (`Flag`, padrão `false`) é uma decisão editorial, que o admin controla pelo formulário. "Ofertas" continua derivado do preço "De:", sem atributo.
- **Seed:** o CLI escolhe os 24 disponíveis com mais avaliações (4 estrelas ou mais e 10 avaliações ou mais; desempate por estrelas e sku) e grava `isFeatured` em `products.json`. A task de seed só lê o campo, e o upsert por sku atualiza o destaque.
- **Regeneração:** `scrape:seed` gera os JSON a partir de `data/kalunga` sem acessar a Kalunga. A pergunta "Popular o banco agora?" é respondida com não, e o seed roda em seguida pelo backend.

Alternativas descartadas:
- **Derivar o destaque da avaliação em tempo de leitura:** avaliações não são gravadas no banco e são assunto de uma funcionalidade futura.
- **Lista de skus escrita à mão:** não se reproduz quando o CLI raspar dados novos.

### 9. Estado da vitrine na URL, com parâmetros em português
- **Parâmetros:** `bairro`, `categoria`, `q`, `marca`, `precoMin`, `precoMax`, `ofertas`, `destaques`, `ordem` e `pagina` seguem o padrão já existente (`bairro`, `categoria`).
- **Tradução:** `storefront-query.util.ts` converte esses parâmetros no filtro da API (reais → centavos, `ordem` → `sort`, `marca` → `brand`) com funções puras.
- **Histórico:** filtros, categoria e ordem usam `router.replace` sem rolar, e página e busca usam `router.push`.
- **Links:** o `query` de `useStorefront` passa a carregar todos os parâmetros, e os cards o repassam ao detalhe para o "← Voltar aos resultados".

Alternativa descartada: expor na URL os nomes da API (`sort=price-asc`, `minPriceCents`). Misturaria idiomas na mesma URL e exporia centavos ao visitante.

### 10. Árvore de categorias carregada uma vez no shell
- **Contexto:** `StorefrontCatalogProvider`, dentro do `StorefrontShell`, carrega `GET /storefront/categories` uma vez por montagem do shell.
- **Uso:** alimenta os chips, os títulos da listagem, as "Categorias em destaque" e a trilha, sem novas chamadas ao navegar entre vitrine e detalhe.
- **Produtos:** vêm de `useStorefrontProducts(filter)`, com a chave de requisição derivada do filtro e a página anterior mantida durante a troca, para não piscar.

Alternativas descartadas:
- **Buscar as categorias em cada página:** geraria requisições repetidas para dados que mudam raramente.
- **Carregar no layout do servidor:** o shell é client e depende de `useSearchParams`, e passar a árvore como prop de servidor exigiria reestruturar o grupo `(public)`.

### 11. Detalhe carregado no servidor
- **Carregamento:** `p/[slug]/page.tsx` chama `getStorefrontProduct` envolvido em `cache()` do React, compartilhado entre `generateMetadata` e a página.
- **404:** `null` resulta em `notFound()`, com status 404 real.
- **Metadados:** título, descrição e imagem Open Graph saem do mesmo resultado.
- **Parte client:** bairro, ETA, galeria, quantidade e aviso continuam no componente client; os produtos da mesma categoria são carregados nele.

Alternativa descartada: carregar tudo no cliente. Perderia o status 404 real e os metadados do produto.

### 12. Fotos com `next/image` e reserva por categoria
- **Imagens usadas:** `ProductArt` recebe `imageUrl` e usa `next/image` (`fill`, `object-contain`, `sizes` por tamanho). Os cards usam `thumbUrl` (cerca de 200px) e a galeria usa `largeUrl` (cerca de 1000px), com `priority` na primeira imagem.
- **Reserva:** sem imagem ou em `onError`, volta ao emoji do mapa `category-art.ts`, indexado pelo slug da categoria raiz (`rootCategorySlug`). O mapa mantém as chaves antigas do mock para o carrinho.
- **Desconto:** `StoreProduct` ganha `discountPercent` vindo da API. O cálculo local do card fica só como reserva para o mock.

Alternativa descartada: `<img>` simples. Perderia o redimensionamento e o carregamento preguiçoso do Next, relevantes numa grade de 24 fotos.

### 13. Carrinho intocado
- **Cards:** a vitrine e o detalhe não passam `onChangeQuantity` para os cards, então o "+" não aparece.
- **Detalhe:** o botão "Adicionar" mantém o stepper e só chama `toast("Carrinho chega já já.")`.
- **Mock:** `storefront.mock.ts` perde só o que ficar sem uso (`relatedProducts`) e mantém `findProduct`, `PRODUCTS`, `ZONES`, `ETA_BY_NEIGHBORHOOD`, `COURIERS_ONLINE`, `CATEGORY_OPTIONS` e `categoryLabel`, usados pelo carrinho, checkout, rodapé e dashboard.

Alternativa descartada: botão desabilitado. Pareceria defeito, e o aviso explica a situação no tom da marca.

### 14. Deltas de spec escolhidos para conviver com as changes abertas
- **`catalog/storefront`:** "Catálogo com dados locais" é **removido** e "Catálogo a partir da API" é adicionado, em vez de alterado. `REMOVED` casa pelo nome do requisito, então funciona com o texto original ou com o texto já alterado por `cadastro-loja`. O novo requisito mantém os bairros agrupados por loja. "Bairro não atendido", "Sacola vazia nesta entrega" e "Fechar pedido leva ao checkout" não são tocados.
- **`shared/design-system`:** só os requisitos contraditos por esta change mudam.
  - "Imagem por categoria" é removido e substituído por "Imagem do produto".
  - "Campo de busca de produtos" é removido e substituído por "Busca no cabeçalho da loja", porque o cenário "Envio sem efeito" deixa de ser verdade.
  - "Grade e card de produto" é alterado, mantendo os nomes dos cenários existentes com o novo comportamento.

## Risks / Trade-offs

- **[Prisma acusar diferença na coluna gerada]** → A migration é criada com `--create-only` e conferida com um segundo `migrate dev`. Se houver diferença persistente, a coluna sai e o documento inteiro passa a ser montado na consulta. A decisão é registrada neste arquivo, e o `.http` mede o tempo de `search=papel`.
- **[Concatenar marca e categorias impede o uso direto do índice GIN]** → Com cerca de mil produtos, a varredura com o `search_document` pronto é barata. Se o catálogo crescer muito, a saída é pré-filtrar pelo índice ou denormalizar os nomes, sem mudar o contrato.
- **[Contagem, página e facetas em consultas separadas podem ver dados de instantes diferentes]** → A diferença só aparece com escrita concorrente durante a leitura, é irrelevante para a vitrine e se corrige na próxima requisição.
- **[Fotos servidas pelo domínio da Kalunga]** → São dados de desenvolvimento. Falhas de carregamento caem na ilustração da categoria.
- **[Links antigos com `categoria=papelaria` e itens do mock no carrinho]** → A listagem mostra o estado sem resultados. O carrinho continua resolvendo os itens pelo mock até a change do carrinho, e a proposta declara a quebra de `categoria`.
- **[Vitrine com produtos reais e carrinho com produtos fictícios]** → A inconsistência é temporária e explícita: os cards não oferecem "+", e o botão do detalhe avisa que o carrinho chega depois.
- **[Divergências antigas em specs]** → "Sacola vazia nesta entrega" (a sacola já persiste itens do mock) e o restante de `shared/design-system` já não descrevem o código. Esta change não os corrige e só evita contradizer o que altera.
- **[Nomes da Kalunga com até 214 caracteres]** → Limite de 3 linhas no card, com o nome completo no `title`.

## Migration Plan

1. `npm run build --workspace=@jaja/catalog` ao fim da etapa de Negócio.
2. `npm run prisma:migrate:dev --workspace=@jaja/backend -- --name catalog_product_storefront --create-only`: escrever o SQL de `is_featured` (com índice), da coluna gerada `search_document` e do índice GIN. Aplicar com `prisma:migrate:dev`, repetir o comando para confirmar que não há nova diferença e rodar `prisma:generate`.
3. `npm run build --workspace=@jaja/catalog` e, em `apps/cli`, `npm run cli -- scrape:seed`, respondendo não à pergunta de popular o banco. Conferir com `git diff` que `products.json` só ganhou `isFeatured`.
4. `npm run prisma:seed --workspace=@jaja/backend` duas vezes: 24 destaques e `search_document` preenchido em todos os produtos.
5. Rollback em desenvolvimento: reverter o commit e recriar o banco com `prisma migrate reset`. Não há dados de produção.
