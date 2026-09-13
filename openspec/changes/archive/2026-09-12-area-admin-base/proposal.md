## Why

Os cadastros do catálogo (marcas, categorias e produtos, prompts 07, 08 e 09) vão expor endpoints que só administradores podem usar e telas que precisam de um lugar no menu do módulo Catálogo. Hoje o backend só sabe exigir token (`JwtGuard`), sem checar a flag `admin`, e a sidebar do admin descarta o rótulo das seções e achata os sub-itens. Esta entrega cria essa base uma única vez, antes do primeiro cadastro, para que cada cadastro apenas a use.

## What Changes

- **Backend: proteção de endpoints administrativos.** Uma forma declarativa de marcar um controller ou um método como administrativo: exige JWT válido (`401` sem token, token expirado ou adulterado) e `admin = true` (`403` com o código `ADMIN_REQUIRED` para usuário comum). Composta pelo guard de JWT já existente seguido de um novo guard de administrador, aplicada por controller (não global). Nenhum endpoint novo é criado; o `401`/`403` passa a ser exercitado pelos testes de integração dos cadastros a partir do prompt 07. Testes unitários cobrem o guard e a ordem dos guards do decorator.
- **Frontend: seções no submenu do módulo ativo.** A sidebar passa a agrupar os sub-itens por seção, na ordem recebida, exibindo o rótulo da seção (quando houver) como cabeçalho discreto e ignorando seções vazias. Mantém a regra de só mostrar sub-itens quando o módulo ativo tem mais de um no total, e não muda itens principais, contador e estado ativo.
- **Frontend: seções do módulo Catálogo.** "Visão geral" (`/admin/catalog`, casamento exato) e a seção "Cadastros", vazia por enquanto. Com um único sub-item, o menu do Catálogo continua visualmente igual ao atual.
- Nada muda no fluxo de autenticação (`/auth/*`), no `AdminGuard` do frontend, em `/admin/login`, no layout de `admin/(shell)` nem nos links da loja para a área administrativa. Nenhuma rota nova no frontend.

**Divergências registradas (fora do escopo desta entrega):** as specs principais estão atrás do código após o redesign (commits `fa20034` e `b527cba`):
- `admin/admin-area`, requisito "Navegação e menu do usuário": lista "Visão geral, Catálogo, Pedidos, Clientes e Lojas", mas o menu atual tem "Dashboard, Pedidos, Produtos & estoque, Entregadores, Clientes, Hubs & cobertura".
- `admin/admin-area`, requisito "Vitrine permanece pública": diz que a área administrativa MUST NOT ser oferecida pela vitrine, mas a loja tem o link "Área administrativa" no rodapé e no menu da conta de administradores. O prompt manda manter os links.
- `shared/design-system`: descreve a sidebar do admin em papel, sem cantos arredondados e com o item ativo marcado por borda vermelha. O código e o `DESIGN.md` usam a sidebar escura com raio 12 e o ativo laranja.

Esta change não reescreve esses requisitos. O cabeçalho de seção segue o `DESIGN.md` e o código atual. Recomenda-se uma change de sincronização de specs à parte.

## Capabilities

### New Capabilities

- `admin/admin-api-authorization`: como a API protege endpoints administrativos: quem recebe `401`, quem recebe `403` (e com qual código), que a proteção vale por controller ou por endpoint, e que endpoints públicos ou só autenticados não são afetados.

### Modified Capabilities

- `admin/admin-area`: requisitos **adicionados** "Submenu do módulo ativo agrupado em seções" e "Seções do módulo Catálogo". Os requisitos existentes não mudam nesta change (ver divergências acima).

## Impact

- `apps/backend/src/shared/auth/`: novo `admin.guard.ts` e `admin.guard.spec.ts`; export em `index.ts`.
- `apps/backend/src/shared/decorators/`: novo `admin-only.decorator.ts` e `admin-only.decorator.spec.ts`; export em `index.ts`.
- `apps/backend/src/shared/shared.module.ts`: `AdminGuard` em `providers` e `exports`.
- `apps/frontend/src/shared/components/ui/sidebar-menu.component.tsx`: renderização por seção com cabeçalho.
- `apps/frontend/src/shared/navigation/app-modules.ts`: seções de `catalog`.
- Sem alteração em: controllers existentes, `JwtGuard`, `JwtStrategy`, Prisma, seed, `@jaja/auth`, `packages/shared`, rotas do frontend e `.claude/skills`.
