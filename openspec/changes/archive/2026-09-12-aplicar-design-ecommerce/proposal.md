## Why

O frontend do Jaja ainda é o template administrativo genérico da skill `config-shared-frontend` (tema escuro com gradientes, primária âmbar, fontes Geist, raio arredondado) e a rota `/` apenas redireciona para `/principal`. O design da aplicação já foi definido pelo Claude Design em `openspec/extras/design` (e-commerce hiperlocal "já já.", visual modernista e flat) e precisa ser aplicado agora, antes das funcionalidades de negócio, para que todos os componentes compartilhados e a página principal nasçam no visual correto.

## What Changes

- **Design system compartilhado (`apps/frontend/src/shared`)**: os tokens de `globals.css` passam a ser os do design (papel `#ffffff`, superfície `#eae9e9`, tinta `#201e1d`, vermelho `#ec3013`), com radius 0, sem sombras, sem gradientes, sem dark mode e sem animações de carregamento. As fontes Geist são substituídas por Archivo (UI), Bricolage Grotesque (display) e IBM Plex Mono (números). Todos os componentes de `shared/components/ui` são restilizados mantendo props e comportamento. **BREAKING**: o bloco `prefers-color-scheme: dark` e a dependência visual de `tw-animate-css` são removidos; o logo deixa de usar a imagem `/logo.webp` (que não existe) e vira o wordmark "já já." com ponto vermelho.
- **Componentes de loja reutilizáveis (`shared/components/store`)**: cabeçalho da vitrine (logo, seletor de bairro, ETA, sacola com contador), filtros de categoria, card e grade de produtos, imagem SVG por categoria, preço em mono e o painel lateral da sacola. Todos controlados por props, sem estado global. Rodapé simples da loja. Novo `StorefrontLayout` em `shared/template`; o layout do grupo público aplica um `StorefrontShell` (header + sacola + rodapé ligados ao estado da vitrine) em todas as páginas públicas, inclusive o detalhe do produto.
- **Shell administrativo**: `AdminShell` e `SidebarMenu` mantêm estrutura e comportamento (sidebar recolhível, sheet no mobile, menu do usuário) mas trocam o visual escuro/gradiente pelo design flat com divisores de 2px.
- **Página principal (vitrine)**: `/` passa a ser a vitrine pública do e-commerce, renderizada pelo módulo `catalog` do frontend com dados mock (categorias, bairros por hub, ETA e produtos). Suporta filtro por categoria e troca de bairro via query string, estado vazio para bairro não atendido e abertura da sacola (vazia nesta entrega). **BREAKING**: o redirect de `/` para `/principal` deixa de existir.
- **Placeholder de detalhe do produto**: rota `/p/[slug]` mínima (caminho, nome em display, preço) para os links dos cards não quebrarem. A página completa fica para outra funcionalidade.
- **Documentação**: `docs/design.md` do design é copiado para `apps/frontend/DESIGN.md` e referenciado em `apps/frontend/AGENTS.md` como regra para toda tela e componente.

## Capabilities

### New Capabilities

- `shared/design-system`: tokens visuais, tipografia, regras globais (radius 0, divisores 2px, sem sombras/animações de carregamento, foco vermelho) e o comportamento visual dos componentes compartilhados de UI, do logo, do shell administrativo e dos componentes reutilizáveis da loja.
- `catalog/storefront`: comportamento da vitrine pública em `/`: seleção de bairro e categoria via query string, grade de produtos com dados mock, estado vazio para bairro não atendido, sacola vazia e navegação para o placeholder de detalhe em `/p/[slug]`.

### Modified Capabilities

Nenhuma. O projeto ainda não possui specs em `openspec/specs/`.

## Impact

- `apps/frontend/src/app`: `layout.tsx` (fontes e metadata), `globals.css` (tokens), remoção de `page.tsx`, novos `(public)/page.tsx` e `(public)/p/[slug]/page.tsx`. `(public)/layout.tsx`, a exceção de `/auth` e os nomes `PublicBoxedLayout`/`PublicGroupLayout` são preservados porque a funcionalidade 03 (registro de usuário) depende deles; o `<Toaster />` continua não montado pelo mesmo motivo.
- `apps/frontend/src/shared`: todos os arquivos de `components/ui`, `components/branding/app-logo.component.tsx`, `template/*`, `navigation/app-sidebar-navigation.component.tsx`, novos `components/store/*`, `util/price.util.ts` e exportações em `index.ts`.
- `apps/frontend/src/modules/catalog`: novos `data/storefront.types.ts`, `data/storefront.mock.ts`, `data/use-storefront.hook.ts`, `components/storefront.component.tsx`, `pages/storefront.page.tsx` e exportações. O `catalog-dashboard.component.tsx` da área privada permanece.
- `apps/frontend/public`: remoção dos SVGs de exemplo do template Next.
- `apps/frontend/package.json`: `tw-animate-css` deixa de ser importado (pode ser removido das devDependencies). Nenhuma dependência nova: as fontes vêm de `next/font/google` e os ícones de `lucide-react`.
- Fora de escopo: backend, `modules/*`, Prisma, API de produtos, lógica de carrinho/persistência, checkout, página completa de detalhe do produto e acompanhamento de pedido.
