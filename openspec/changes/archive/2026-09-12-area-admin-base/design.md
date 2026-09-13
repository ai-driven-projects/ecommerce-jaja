## Context

Motivação em `proposal.md` (seção Why); requisitos em `specs/admin/admin-api-authorization` e `specs/admin/admin-area`. Estado atual que condiciona a abordagem:

- **Backend.** `JwtGuard` (`shared/auth/jwt.guard.ts`) estende `AuthGuard('jwt')`, depende de `Reflector` e deixa passar rotas `@Public()` (metadata `PUBLIC_ROUTE`, lida no handler e na classe). É provider exportado do `SharedModule` (`@Global()`), não `APP_GUARD`. `auth.controller.ts` aplica `@UseGuards(JwtGuard)` na classe e marca `register`/`login` com `@Public()`. A `JwtStrategy` preenche `request.user` com `AppUser` (`id`, `name`, `email`, `admin`) via `mapPayloadToAuthenticatedUser`, que já normaliza `admin` para booleano. `AuthenticatedRequest` (`shared/types`) tipa `request.user`. O `jwt.guard.ts` importa `../decorators/public.decorator.js` pelo arquivo. Vitest roda `**/*.spec.ts` com `globals: true`; `GUARDS_METADATA = '__guards__'` existe em `@nestjs/common/constants`.
- **Frontend.** `SidebarMenu` recebe `items` e `sections`, faz `sections.flatMap(s => s.items)`, descarta `label` e só exibe os aninhados (`nested`, `pl-11`, `text-[13px]`) sob o item principal ativo quando há mais de um. `AppSidebarNavigation` passa `resolveAppSidebarState(pathname).sections`. Todos os módulos em `sectionsByModuleId` têm `[]`. `isSidebarItemActive` já suporta `match: 'exact' | 'prefix'`. O `DESIGN.md` define rótulos de grupo como `text-xs font-extrabold uppercase tracking-[0.04em]` e o texto secundário sobre o fundo escuro como `text-dark-muted`.

## Goals / Non-Goals

**Goals:**
- Um único ponto declarativo (`@AdminOnly()`) para os cadastros usarem na classe ou no método, sem precisar lembrar a ordem dos guards.
- `401` antes de `403` garantido pela composição, e verificado por teste.
- Sidebar capaz de exibir seções rotuladas, sem mudança visual enquanto nenhum módulo tem mais de um sub-item.

**Non-Goals:**
- Nenhum endpoint, controller, rota Next ou tela nova. Nenhum teste e2e/integração nesta entrega.
- Não alterar `JwtGuard`, `JwtStrategy`, `auth.controller.ts`, os controllers placeholder, o `AdminGuard` do frontend, `/admin/login` ou `admin/(shell)/layout.tsx`.
- Não introduzir papéis/permissões genéricos (`@Roles`) nem recarregar o usuário do banco a cada requisição.
- Não corrigir as divergências das specs principais listadas na proposta.

## Decisions

### 1. Composição por controller com `applyDecorators(UseGuards(JwtGuard, AdminGuard))`
O Nest executa os guards de um mesmo `@UseGuards` na ordem declarada, e os guards de classe antes dos de método. Com `JwtGuard` primeiro, `request.user` já existe (ou a resposta já é `401`) quando o `AdminGuard` roda. `applyDecorators` retorna um decorator que funciona em classe e em método.
Alternativa rejeitada: registrar os guards como `APP_GUARD`. Guards globais rodam antes dos guards de controller, então o `AdminGuard` global rodaria sem `request.user` e exigiria token em `GET /` e nos placeholders. Seria preciso inverter o modelo (tudo protegido, `@Public()` em tudo que é aberto), o que muda o comportamento atual.
Alternativa rejeitada: um único guard que valida o JWT e a flag. Duplicaria a lógica do `JwtGuard` (incluindo `@Public()`) e perderia o reuso do Passport.

### 2. `AdminGuard` sem dependências, com `401` defensivo
Lê `context.switchToHttp().getRequest<AuthenticatedRequest>().user`. Sem `user`, lança `UnauthorizedException`: cobre o caso de alguém combinar `@AdminOnly()` com `@Public()`, em que o `JwtGuard` deixa passar sem autenticar. O resultado é `401`, nunca acesso anônimo, como exige a spec. Com `user.admin !== true`, lança `ForbiddenException('ADMIN_REQUIRED')`: a comparação estrita trata `undefined` como não administrador. Caso contrário, retorna `true`. O corpo de erro sai pelo `ApiExceptionFilter` já existente, sem mudança nele.
Alternativa rejeitada: guard baseado em metadata e `Reflector` (`@Roles('admin')`). Hoje existe só uma flag booleana, e um mecanismo de papéis seria especulativo.

### 3. Imports pelo arquivo, não pelos barrels
`admin-only.decorator.ts` importa `../auth/jwt.guard.js` e `../auth/admin.guard.js`. `shared/decorators/index.ts` passa a exportar o decorator, e `shared/auth/index.ts` reexporta módulos que importam de `decorators`. Importar pelo `index` criaria um ciclo entre os barrels, com risco de valores `undefined` em tempo de carga no ESM. Segue o padrão já usado por `jwt.guard.ts`.

### 4. `AdminGuard` como provider exportado do `SharedModule`
Mantém paridade com o `JwtGuard` e deixa o guard injetável em qualquer módulo sem import extra, porque o `SharedModule` é `@Global()`. Como o `AdminGuard` não tem dependências, a resolução não traz risco.

### 5. JSDoc como contrato de uso
O JSDoc do `@AdminOnly()` diz: aplicável a classe ou método; responde `401` sem token válido e `403` com `ADMIN_REQUIRED` para não administrador; não deve ser combinado com `@Public()`. Em um controller já com `@UseGuards(JwtGuard)` na classe, usar `@AdminOnly()` em um método faz o `JwtGuard` rodar duas vezes, o que é inofensivo. Os cadastros devem preferir `@AdminOnly()` na classe.

### 6. Testes unitários em vez de endpoint de teste
- `admin.guard.spec.ts`: `ExecutionContext` falso (`{ switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext`), no estilo do `createHost` de `api-exception.filter.spec.ts`. Casos: `admin: true` → `true`; `admin: false` → `ForbiddenException`; sem `user` → `UnauthorizedException`.
- `admin-only.decorator.spec.ts`: `@AdminOnly() class TestController {}` e `Reflect.getMetadata(GUARDS_METADATA, TestController)` igual a `[JwtGuard, AdminGuard]`.
O comportamento HTTP completo (`401`/`403`) será coberto pelo `brand.integration.http` do prompt 07. Alternativa rejeitada: criar um controller só para testes, porque o prompt veda endpoints novos.

### 7. `SidebarMenu`: seções visíveis, total e cabeçalho
- `visibleSections = sections.filter((s) => s.items.length > 0)`; `showNested` quando a soma dos itens de `visibleSections` for maior que 1. A regra de exibição não muda, e seções vazias somem com o rótulo.
- Sob o item principal ativo, cada seção vira um `div` com `role="group"` (chave `section.id`). Quando há `label`, o `div` tem `aria-labelledby` apontando para o cabeçalho, e o cabeçalho é um elemento de texto não interativo com as classes `pb-1 pl-11 pr-[13px] pt-2 text-xs font-extrabold uppercase tracking-[0.04em] text-dark-muted`: rótulo de grupo do `DESIGN.md`, recuo `pl-11` igual ao dos sub-itens, sem ícone. Itens continuam `SidebarItemLink nested`.
- `SidebarItemLink`, `isSidebarItemActive`, os tipos exportados e o comentário das props (atualizado para mencionar seções) seguem compatíveis. Nenhuma prop nova.
Alternativa rejeitada: um elemento de título (`h3`) por seção. Dentro de um `nav` compacto, isso polui a hierarquia de títulos da página; `role="group"` com rótulo dá a mesma informação a leitores de tela.

### 8. Seções do Catálogo em `app-modules.ts`
`catalog: [{ id: 'catalog-overview', items: [{ id: 'catalog-overview', label: 'Visão geral', href: CATALOG_ROUTE, match: 'exact' }] }, { id: 'catalog-registrations', label: 'Cadastros', items: [] }]`, com um comentário na seção "Cadastros": os prompts 07, 08 e 09 adicionam "Marcas", "Categorias" e "Produtos", nessa ordem, com `match: 'prefix'`. O `match: 'exact'` em "Visão geral" é necessário porque `/admin/catalog` é prefixo das rotas dos cadastros. Seção e item compartilharem o id `catalog-overview` não conflita: são listas e chaves React distintas.

### 9. Execução em dois subagentes
Por instrução do prompt, o backend (tarefas 1.x) e o frontend (tarefas 2.x) são implementados em subagentes separados, com contexto limpo. Ambos leem `.claude/skills/skills-standards.md`, e o do frontend lê também `apps/frontend/DESIGN.md`. As partes não compartilham arquivos e podem rodar em paralelo.

## Risks / Trade-offs

- [Ordem dos guards invertida em edição futura → `403` em vez de `401`] → O teste do decorator falha se a ordem mudar.
- [`@AdminOnly()` combinado com `@Public()`] → O `AdminGuard` responde `401` por falta de `user` (falha segura), e o JSDoc desencoraja a combinação.
- [Flag `admin` desatualizada no token por até 7 dias após promoção ou rebaixamento] → Aceito e explícito na spec. Revogação imediata exigiria consulta ao banco por requisição, fora do escopo.
- [Regressão visual na sidebar dos módulos atuais] → Todos têm no máximo um sub-item após a mudança, então `showNested` fica falso. A validação manual percorre todos os módulos.
- [Item fictício de validação esquecido em `app-modules.ts`] → A tarefa de validação exige conferir, pelo diff, que "Cadastros" termina com `items: []`.
- [Specs principais divergentes do código (sidebar, navegação, links da loja)] → Registrado na proposta. Esta change só adiciona requisitos, e a sincronização fica para uma change própria.

## Migration Plan

1. Backend: `AdminGuard`, `@AdminOnly()`, `SharedModule`, exports e testes. Test e build.
2. Frontend: `SidebarMenu` por seções e seções do Catálogo. Lint, build e validação visual com item fictício temporário.
3. Sem migração de dados nem de configuração. Rollback: reverter o commit. Nenhum consumidor usa `@AdminOnly()` ainda.
