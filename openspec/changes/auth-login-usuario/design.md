## Context

Ver `proposal.md - Why` para a motivação. Estado atual que condiciona a abordagem:

- Todas as rotas em `src/app/(public)/` são envolvidas pelo `StorefrontShell` via `(public)/layout.tsx`. Dentro do shell, `ConnectedHeader` (em `Suspense`, porque usa `useSearchParams`) lê `useStorefront()` e `useAuth()`, monta o `signInHref`, alimenta o `StorefrontHeader` e passa `onCheckout={noop}` ao `BagSheet`.
- `useStorefront()` (`modules/catalog/data/use-storefront.hook.ts`) tem a URL como fonte de verdade (`bairro`, `categoria`), expõe `closeBag()` e `buildStorefrontQuery(neighborhood, category)`. Rotas da loja em `shared/navigation/storefront-routes.ts` (`STOREFRONT_ROUTE`, `STOREFRONT_LOGIN_ROUTE`).
- `modules/auth` já entrega `AuthForm` (`defaultMode?`, `onSignedIn(user, mode)`), `useAuth` (`user`, `isAuthenticated`, `signOut`, ...), `firstNameOf` e a página `/entrar` (`StorefrontLoginPage`), que tem a função interna `welcomeMessage(user, mode)` e um `useEffect` que redireciona quem já tem sessão para `voltar`.
- `AuthProvider` e `<Toaster />` (sonner) já estão no root layout; a sessão vive no cookie `jaja_auth` e é lida de forma síncrona na inicialização, então um reload não passa por um estado "sem sessão" intermediário.
- `BagSheet` só renderiza o rodapé com "Fechar pedido" quando `hasItems`; a sacola é sempre vazia nesta entrega (o carrinho é outra funcionalidade).
- `modules/orders` é um scaffold (`DashboardPage` para `/admin/orders`, `data/index.ts` vazio). Textos da loja são hardcoded em pt-BR; `shared/i18n` não é usado por componentes de loja/auth.
- `auth.integration.http` já cobre "registro seguido de login com as mesmas credenciais" nos passos 1 (`@name register`, `{{newEmail}}`) e 8 (login com `{{newEmail}}`, `admin = false`).

## Goals / Non-Goals

**Goals:**
- `/checkout` como uma única página que alterna o conteúdo pelo estado de `useAuth`, sem redirecionamento e sem guard.
- Reaproveitar `AuthForm`, mensagens e padrão visual de `/entrar` sem alterar o comportamento de `/entrar`.
- Ligar `onCheckout` no ponto onde o estado da vitrine e o roteador já estão disponíveis (`ConnectedHeader`).

**Non-Goals:**
- Não implementar carrinho, itens na sacola, endereço, pagamento ou criação de pedido.
- Não alterar `BagSheet`, `StorefrontHeader`, `AdminGuard`, `/admin/*`, backend, Prisma, seed ou `@jaja/auth`.
- Não introduzir i18n nem middleware do Next.

## Decisions

### 1. A página vive em `modules/orders`, não em `modules/auth`
O checkout é o início do fluxo de pedido; a identificação do cliente é um passo dele. `modules/auth` fornece o formulário e o contexto, `modules/orders/pages/checkout.page.tsx` os consome. Alternativa rejeitada: colocar em `auth` (misturaria o placeholder de pedido com o módulo de sessão) ou em `catalog` (o checkout não é vitrine).

### 2. Alternância por contexto, sem redirect
`/entrar` redireciona quem já tem sessão para `voltar`; o checkout faz o oposto: renderiza `AuthForm` quando `isAuthenticated` é falso e o placeholder quando é verdadeiro, no mesmo componente. `onSignedIn` só dispara o toast; a troca de conteúdo vem da atualização do contexto. Isso também cobre "sair" no cabeçalho (o contexto zera e o formulário volta) sem código extra. Alternativa rejeitada: `router.replace('/checkout')` após o login (navegação redundante que perderia a query se mal montada) ou reutilizar `StorefrontLoginPage` com uma prop (traria o `useEffect` de redirect que não queremos).

### 3. Reaproveitar a mensagem de boas-vindas exportando `welcomeMessage` de `storefront-login.page.tsx`
A função já existe e já é o texto validado na 03. Tornar a função exportada é uma mudança de uma palavra, sem efeito em `/entrar` (o arquivo já exporta `resolveReturnTo`). Alternativa rejeitada: duplicar as strings no checkout (dois lugares para manter) ou criar um util novo e reescrever o import em `/entrar` (mais toque no arquivo que deveria ficar intacto).

### 4. `CHECKOUT_ROUTE` em `storefront-routes.ts`
Segue o padrão das constantes de rota da loja. O link "voltar para a vitrine" usa `STOREFRONT_ROUTE` + `buildStorefrontQuery(neighborhood, category)`, o mesmo helper dos cards de produto, garantindo a mesma serialização de `bairro`/`categoria`.

### 5. `onCheckout` em `ConnectedHeader`: `closeBag()` e depois `router.push`
`ConnectedHeader` já tem `storefront` (bairro, categoria, `closeBag`) e está dentro de `Suspense`; basta adicionar `useRouter` de `next/navigation`. Fechar antes de navegar evita a sacola aberta ao chegar em `/checkout`, já que o shell persiste entre rotas do grupo público. `push` (não `replace`) para que "voltar" do navegador retorne à vitrine. `onChangeQuantity` continua `noop`.

### 6. `Suspense` + skeleton estático no checkout
`useStorefront` chama `useSearchParams`, que exige limite de `Suspense` no App Router. O conteúdo fica em um componente interno; o fallback repete a estrutura (título e réguas em `text-placeholder`/`border-placeholder`), sem shimmer, como em `StorefrontLoginPage` e `StorefrontPage`.

### 7. Backend sem cenário novo
Adicionar um passo "registro + login" duplicaria os passos 1 e 8. Só se acrescenta um comentário no cabeçalho do passo 8 apontando para o passo 1 e a validação é reexecutar os dois com o backend no ar.

### 8. `BagSheet` intacto; "Fechar pedido" verificado por código e build
O botão não renderiza com a sacola vazia e a spec da vitrine ("Sacola vazia nesta entrega") diz que nada adiciona itens. Mostrar o botão na sacola vazia seria mudar essa spec. Nesta entrega a ligação é verificada por leitura do diff, lint e build; a página `/checkout` é validada por URL direta. Ver `proposal.md - Premissa registrada`.

## Risks / Trade-offs

- [O fluxo "clicar em Fechar pedido" não é exercitável na UI nesta entrega] → Premissa explícita na proposta; a spec `catalog/storefront` deixa claro que o requisito vale assim que houver itens. O primeiro change de carrinho deve incluir esse cenário na validação manual.
- [Formulário com `defaultMode` errado após "sair" no checkout] → `AuthForm` remonta quando `isAuthenticated` volta a `false`; usar o padrão `login`, como em `/entrar`.
- [Query perdida ao entrar/criar conta] → Nenhuma navegação acontece; a URL não é tocada.
- [Toast duplicado se `onSignedIn` também navegasse] → Decisão 2: só toast.
- [Nome `CheckoutPage` conflitar com exports de outros módulos via `export *`] → Não há outro `CheckoutPage`; `DashboardPage` genérico já coexiste em vários módulos sem conflito porque cada módulo é importado pelo próprio caminho.

## Migration Plan

1. `CHECKOUT_ROUTE` e `welcomeMessage` exportado.
2. `CheckoutPage` + wrapper de rota + export no módulo.
3. `onCheckout` no shell.
4. Lint, build, validação manual com backend e banco no ar.
5. Rollback: reverter o commit; sem estado externo afetado.
