## Context

Ver `proposal.md` para a motivação. Estado atual e restrições que moldam a abordagem:

- `apps/frontend` é Next.js 16 (App Router), React 19, Tailwind v4 (`@import 'tailwindcss'` + `@theme inline` em `globals.css`) e componentes estilo shadcn em `src/shared/components/ui`, todos consumindo tokens semânticos (`bg-background`, `text-muted-foreground`, `border-border`, `rounded-md`, etc.). As telas dos módulos usam esses componentes; trocar os tokens e as classes-base dos componentes propaga o design para toda a aplicação sem tocar nos módulos.
- A referência de implementação em `openspec/extras/design/apps/web` é Vite + react-router + CSS Modules, com nomes em português. Serve como referência de medidas e comportamento (Barra, Sacola, Vitrine, ImagemCategoria), não como código a copiar.
- `openspec/extras/design/docs/design.md` é a fonte de verdade visual e os requisitos estão em `specs/shared/design-system/spec.md` e `specs/catalog/storefront/spec.md`.
- Não há API de produtos. `modules/catalog` (domínio) é scaffold e não é alterado nesta mudança.
- A funcionalidade 03 (registro de usuário) depende dos nomes `PublicBoxedLayout` e `PublicGroupLayout`, da exceção `/auth` no layout público e de o `<Toaster />` não estar montado no root layout. Esses pontos são preservados.
- `app-logo.component.tsx` referencia `/logo.webp`, que não existe em `apps/frontend/public`.

## Goals / Non-Goals

**Goals:**
- Um único ponto de verdade para o visual (`globals.css` + `DESIGN.md`): tokens do design remapeados para os tokens semânticos já usados, de modo que componentes e módulos existentes mudem de visual sem alteração de API.
- Componentes de loja em `shared/components/store` totalmente controlados por props, sem estado global, reutilizáveis nas próximas telas (detalhe do produto, checkout, acompanhamento).
- Vitrine funcional em `/` com dados mock isolados em `modules/catalog/data`, prontos para serem trocados por chamadas de API sem mudar os componentes.

**Non-Goals:**
- Substituir Tailwind por CSS Modules, ou adicionar biblioteca de componentes.
- Implementar carrinho, checkout, detalhe completo do produto, acompanhamento de pedido ou qualquer integração com backend.
- Redesenhar os dashboards dos módulos da área privada além do que os componentes compartilhados e o shell propagam.

## Decisions

### 1. Tokens: remapear os semânticos do shadcn em vez de trocar classes nos componentes
Os componentes já usam `bg-background`, `text-primary`, `border-border` etc. Redefinir em `globals.css` `--background→var(--bg)`, `--foreground→var(--ink)`, `--primary→var(--ink)`, `--primary-foreground→var(--bg)`, `--secondary/--muted→var(--surface)`, `--muted-foreground→var(--muted-ink)`, `--border/--input→var(--ink)`, `--ring/--destructive→vermelho` e `--radius: 0` faz a maior parte da migração de uma vez. O bloco `@media (prefers-color-scheme: dark)` é removido (design com um único look).
Alternativa rejeitada: reescrever cada componente com cores literais. Espalharia hex por dezenas de arquivos e quebraria a coerência que o remapeamento dá de graça.
Conflito de nome: `--accent` significa "superfície de hover" no shadcn e "vermelho" no design. Mantemos `--accent` como o vermelho do design (compatível com `DESIGN.md`) e o hover-surface do shadcn passa a resolver para `--surface`; no `@theme` do Tailwind expomos `--color-brand` (vermelho), `--color-paper` e `--color-ink` para uso explícito nos componentes novos. Dentro dos componentes de `ui/`, usos de `bg-accent`/`text-accent-foreground` continuam válidos (hover em superfície).

### 2. Fontes via `next/font/google`, expostas como variáveis
`Archivo` (400/600/800), `Bricolage Grotesque` (eixo `opsz`, pesos 600–800) e `IBM Plex Mono` (400/600) carregadas em `src/app/layout.tsx` com `variable: '--font-ui' | '--font-display' | '--font-mono'`, e o `@theme` mapeia `--font-sans: var(--font-ui)` e `--font-mono: var(--font-mono)`, mais `--font-display`. Assim `font-sans`/`font-mono`/`font-display` do Tailwind já resolvem para as fontes certas.
Alternativa rejeitada: `<link>` do Google Fonts como na referência Vite. `next/font` evita layout shift e mantém o padrão do projeto.

### 3. Sem animação de carregamento: remover `tw-animate-css`
O design proíbe animação de entrada. Remover `@import 'tw-animate-css'` de `globals.css` e as classes `animate-in`/`fade-in`/`zoom-in`/`slide-in-*` dos componentes Radix (`dialog`, `sheet`, `popover`, `dropdown-menu`, `tooltip`) e `animate-pulse` de `form-skeleton.tsx`. Transições de hover/estado ficam com `transition-colors duration-100` no máximo.
Regra prática para o implementador: `grep -rn "animate-\|shadow-\|rounded-\|blur\|gradient" src/shared` deve retornar vazio ao final (exceto `rounded-none` se usado explicitamente).

### 4. Logo como wordmark, sem imagem
`AppWordmark` renderiza `já já<span class="text-brand">.</span>` em Archivo 800; `AppLogoMark` renderiza a forma reduzida `jj.` (mesma tipografia, ponto vermelho) para sidebars recolhidas; `AppLogo` mantém a assinatura de props (`size`, `showMark`, `showText`, `withText`, `priority`, classes). Isso corrige a dependência do `/logo.webp` inexistente sem tocar nos consumidores (`sidebar-menu.component.tsx`).

### 5. Componentes de loja controlados por props em `shared/components/store`
`StorefrontHeader`, `CategoryFilters`, `ProductGrid`/`ProductCard`, `CategoryImage`, `Price` e `BagSheet` recebem dados e callbacks por props e não conhecem query string, mock ou API. Tipos mínimos (`StoreProduct`, `BagItem`) ficam em `shared/components/store/store.types.ts` para não acoplar o shared ao módulo `catalog`; o módulo mapeia seus tipos para esses.
`BagSheet` é implementado com o `Sheet` compartilhado (Radix Dialog): já entrega foco inicial, retorno do foco ao trigger, `Escape` e clique no overlay, atendendo a spec sem código manual de foco. O `SheetContent` recebe classes para largura `min(420px,100vw)` e borda esquerda 2px.
Alternativa rejeitada: portar a `Sacola` com `useEffect` + `document.addEventListener` como na referência. Reimplementaria o que o Radix já faz.

### 6. `StorefrontShell` no layout do grupo público
`StorefrontLayout` (em `shared/template`) recebe `header` e `footer` por prop e renderiza `children` em largura total sobre papel. O módulo `catalog` expõe `StorefrontShell`, que liga `StorefrontHeader` + `BagSheet` ao `useStorefront` (dentro de `<Suspense>`, porque `useSearchParams` exige) e adiciona o `StorefrontFooter` compartilhado. `(public)/layout.tsx` envolve todas as páginas públicas (exceto `/auth`) nesse shell, então o cabeçalho, a sacola e o rodapé permanecem visíveis ao navegar para `/p/[slug]`. `PublicBoxedLayout` continua existindo (delegando ao `StorefrontLayout` sem header) para a funcionalidade 03.
Alternativa rejeitada: cada página injetar o próprio header. Faria o cabeçalho sumir no detalhe do produto e duplicaria a ligação com o estado.

### 7. Estado da vitrine em um hook do módulo `catalog`, com a URL como fonte de verdade
`useStorefront` em `modules/catalog/data/use-storefront.hook.ts` lê `bairro`/`categoria` com `useSearchParams` e escreve com `router.replace` (sem `scroll`), deriva `served`, `etaMinutes`, `visibleProducts` e `hubs` a partir de `storefront.mock.ts` e controla `isBagOpen` com `useState`. Nada em `localStorage`. A página `(public)/page.tsx` envolve o componente em `<Suspense>` porque `useSearchParams` exige isso no App Router para build estático.
Alternativa rejeitada: estado em `useState` com sincronização manual da URL. A URL como fonte de verdade elimina o render intermediário com estado desatualizado no reload.

### 8. Placeholder de `/p/[slug]` como página de servidor
`(public)/p/[slug]/page.tsx` é um Server Component que busca o produto no mock pelo slug e chama `notFound()` se não existir; lê `searchParams` para montar o link "vitrine" preservando `bairro`/`categoria`. Sem hook, sem cliente. Mantém o mock como única fonte e deixa a rota pronta para a página completa.

### 9. Shell administrativo: só estilos
`admin-shell.component.tsx`, `sidebar-menu.component.tsx` e `sheet`/`popover` usados por eles trocam as classes de fundo preto, gradientes, `backdrop-blur`, sombras e `rounded-*` por papel, divisores `border-ink border-b-2`/`border-r-2`, item ativo com `border-l-2 border-brand`, avatar `border-2 border-ink` quadrado. Props, `useShell`, `Sheet` mobile e `DropdownMenu` do usuário permanecem. O comentário "Previous active treatment..." e as constantes de classe são atualizados no lugar.

### 10. Dados mock como módulo tipado
`storefront.types.ts` (`Category`, `Product`, `Zone`) e `storefront.mock.ts` (`CATEGORIES`, `ZONES`, `UNSERVED_NEIGHBORHOODS`, `ETA_BY_NEIGHBORHOOD`, `PRODUCTS`) exportados por `modules/catalog/data/index.ts`. Quando a API existir, o hook troca a origem dos dados e os componentes não mudam.

## Risks / Trade-offs

- [Remapear `--border` para tinta deixa todas as bordas de 1px pretas e fortes] → Componentes compartilhados passam para `border-2` onde a spec pede divisor forte e para `border-rule-soft` (1px `#d5d3cf`) nas linhas internas de tabela; revisar visualmente os dashboards dos módulos.
- [Remover dark mode pode surpreender quem usa tema escuro no SO] → Decisão de design explícita (um único look); registrada em `DESIGN.md`.
- [Fontes do Google via `next/font` exigem rede no build] → Padrão já usado pelo projeto com Geist; sem mudança de risco.
- [`useSearchParams` sem `Suspense` quebra o `next build`] → Página da vitrine envolve o componente cliente em `<Suspense>` com fallback estático em `#B0ADA4` (estrutura sem shimmer).
- [Remoção de `tw-animate-css` pode deixar classes órfãs em componentes não revisados] → Varredura final por `animate-` em `src/shared` e `src/modules` como critério de aceite.
- [O shell público chama `useStorefront` e a vitrine também] → Dois leitores da mesma URL; só o shell guarda o estado da sacola. Quando o carrinho existir, o estado sobe para um contexto no shell.
- [Mudança ampla em `shared/components/ui` sem testes de UI] → Critério de aceite inclui `lint`, `build` e conferência visual das rotas listadas em `tasks.md` contra `Vitrine.dc.html`.

## Migration Plan

1. Aplicar tokens, fontes e regras globais (`globals.css`, `layout.tsx`, `DESIGN.md`).
2. Restilizar componentes de `ui/`, logo e shell administrativo.
3. Criar componentes de loja e `StorefrontLayout`.
4. Criar mock, hook, componente e página da vitrine; trocar a rota `/`; criar `/p/[slug]`.
5. Validar com `lint`, `build` e conferência visual.

Rollback: reverter o commit da mudança; não há migração de dados nem alteração de backend.
