---
name: config-shared-frontend
description: Configura a estrutura compartilhada (shared/) e as rotas Next.js (grupos public/private com sidebar de navegação) em um projeto frontend de destino. Usa os assets embarcados nesta skill como fonte — nenhuma dependência de outro projeto em runtime. Conduz a IA de forma determinística com base no contexto do projeto destino.
tools: Read, Glob, Grep, Bash, Write, Edit
---

# config-shared-frontend

## Comando oficial (determinístico)

Execute sempre a partir da raiz do monorepo:

```bash
node <SKILLS_DIR>/config-shared-frontend/scripts/apply.mjs
```

Esse script aplica toda a skill de forma idempotente (dependências, `shared/`, navegação, rotas e formatação).

Recria a pasta `shared/` e a estrutura de rotas Next.js em qualquer projeto frontend de destino.  
Todos os arquivos necessários estão **embarcados** nesta skill em `assets/` — a skill é autossuficiente.

## Localização dos assets

Os assets desta skill estão em:

```
<SKILLS_DIR>/config-shared-frontend/assets/
  shared/          ← pasta shared completa, genérica, pronta para copiar
  navigation/      ← templates de app-modules, rotas e sidebar navigation
  app/             ← templates de layouts e páginas de rota Next.js
```

---

## Fase 1 — Ler contexto do projeto destino

Antes de qualquer ação, leia o contexto do projeto destino para conduzir a instalação de forma inteligente.

```bash
# Identificar estrutura do projeto destino
ls {DEST}/src/app/
ls {DEST}/src/ 2>/dev/null || ls {DEST}/app/ 2>/dev/null
cat {DEST}/package.json | grep -E '"name"|"next"|"react"'
cat {DEST}/tsconfig.json | grep -A5 '"paths"'
```

Capture:

- Nome do projeto (`package.json > name`)
- Versão do Next.js
- Alias de paths (`@/*` → `./src/*` ou `./app/*`)
- Se já existe pasta `shared/` no destino (pedir confirmação antes de sobrescrever)
- Se já existe estrutura `app/(private)/` ou `app/(public)/`

---

## Fase 2 — Resolver configuração automaticamente (sem perguntas)

**Não fazer perguntas ao usuário.** Resolver tudo automaticamente com os seguintes defaults:

### Nome do app

Extrair do `package.json > name` do projeto destino:

- Se o nome for `@namespace/frontend` ou `@namespace/web`, usar a parte após `/` em PascalCase  
  Exemplo: `@hublocal/frontend` → `HubLocal`
- Se não houver namespace, usar o nome diretamente em PascalCase  
  Exemplo: `myapp` → `Myapp`

### Módulos de navegação

Criar um único módulo temporário chamado **Principal**:

```
id:         principal
label:      Principal
shortLabel: Principal
icon:       LayoutDashboard
href:       /principal
submenu:    nenhum
```

### Rotas públicas

Criar apenas uma rota pública unificada de autenticação:

```
/auth    → app/(public)/auth/page.tsx
```

Não criar `/auth/sign-in` ou `/auth/sign-up` separados.

### Guard de autenticação

**Sempre** incluir o `RouteGuard` no layout de `(private)`.  
O asset já está embarcado em `assets/shared/auth/route-guard.component.tsx`.  
Ele verifica `localStorage.getItem('auth_token')` ou cookie `auth_token`.  
Redireciona para `/auth` se não autenticado.

---

## Fase 3 — Instalar dependências do frontend

Antes de copiar os assets, garantir que todas as dependências estão instaladas no workspace do frontend:

```bash
npm install \
  lucide-react \
  clsx \
  tailwind-merge \
  class-variance-authority \
  radix-ui \
  react-hook-form \
  react-day-picker \
  date-fns \
  recharts \
  sonner \
  @radix-ui/react-checkbox \
  @radix-ui/react-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-label \
  @radix-ui/react-popover \
  @radix-ui/react-radio-group \
  @radix-ui/react-separator \
  @radix-ui/react-slot \
  @radix-ui/react-tabs \
  --workspace {FRONTEND_PACKAGE_NAME}
```

Onde `{FRONTEND_PACKAGE_NAME}` é o valor de `name` no `package.json` do destino (ex: `@hublocal/frontend`).

---

## Fase 4 — Copiar a pasta shared/

### 4a. Detectar src root do destino

```bash
ls {DEST}/src/shared 2>/dev/null && echo "HAS_SHARED" || echo "NO_SHARED"
```

Se `shared/` já existir: **avisar e pedir confirmação explícita** antes de sobrescrever.

### 4b. Copiar todos os arquivos de assets/shared/

```bash
cp -r {SKILL_DIR}/assets/shared/. {DEST}/src/shared/
echo "shared/ copiada"
```

Onde `{SKILL_DIR}` = `<SKILLS_DIR>/config-shared-frontend`

### 4c. Personalizar AppLogo com o nome real

Editar `{DEST}/src/shared/components/branding/app-logo.component.tsx`:

- Substituir `const APP_NAME = 'App';` pelo nome resolvido na Fase 2.

### 4d. Verificar alias de import

```bash
cat {DEST}/tsconfig.json | grep -A3 '"paths"'
```

Se `@/*` não existir, adicionar:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## Fase 5 — Gerar arquivos de navegação

### 4a. Criar arquivo de rotas do módulo principal

Criar `{DEST}/src/shared/navigation/principal-routes.ts`:

```ts
export const PRINCIPAL_ROUTE = '/principal';
```

### 4b. Gerar app-modules.ts

Criar `{DEST}/src/shared/navigation/app-modules.ts` baseado no template
`assets/navigation/app-modules.template.ts`, preenchendo com os dados do módulo Principal:

- `AppModuleId` = `'principal'`
- `moduleItems` = item único com `id: 'principal'`, `label: 'Principal'`, `href: '/principal'`, `icon: LayoutDashboard`
- `sidebarStateByModuleId['principal']` = seção vazia (sem itens)
- `resolveAppSidebarState` default = `'principal'`
- Obrigatório exportar também:
  - `getAppModuleItems()`
  - `getAppModuleNavigationEntries()`

Exemplo mínimo funcional:

```ts
import { LayoutDashboard } from 'lucide-react';
import type { SidebarMenuItem, SidebarMenuSection } from '@/shared/components/ui/sidebar-menu.component';

export type AppModuleId = 'principal';

export type AppSidebarState = {
  activeModuleId: AppModuleId;
  mainItem?: SidebarMenuItem;
  sections: SidebarMenuSection[];
};

export type AppModuleNavigationEntry = {
  item: SidebarMenuItem;
  mainItem?: SidebarMenuItem;
  sections: SidebarMenuSection[];
};

type AppModuleItem = SidebarMenuItem & { id: AppModuleId };

const moduleItems: AppModuleItem[] = [
  { id: 'principal', label: 'Principal', shortLabel: 'Principal', href: '/principal', icon: LayoutDashboard },
];

const sidebarStateByModuleId: Record<AppModuleId, AppSidebarState> = {
  principal: { activeModuleId: 'principal', sections: [] },
};

export function getAppModuleItems(): AppModuleItem[] {
  return moduleItems;
}

export function getAppModuleNavigationEntries(): AppModuleNavigationEntry[] {
  return getAppModuleItems().map((item) => {
    const sidebarState = sidebarStateByModuleId[item.id];
    return { item, mainItem: sidebarState.mainItem, sections: sidebarState.sections };
  });
}

export function resolveAppSidebarState(pathname: string): AppSidebarState {
  const activeModuleItem = getAppModuleItems().find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (activeModuleItem) return sidebarStateByModuleId[activeModuleItem.id];
  return sidebarStateByModuleId.principal;
}
```

### 4c. Criar AppSidebarNavigation

Copiar `assets/navigation/app-sidebar-navigation.template.tsx` para
`{DEST}/src/shared/navigation/app-sidebar-navigation.component.tsx` sem alterações.

---

## Fase 6 — Criar estrutura de rotas Next.js

### 6a. Layout do grupo (private)

Criar `{DEST}/src/app/(private)/layout.tsx` a partir de
`assets/app/(private)/layout.template.tsx` **sem modificações**.

O template já inclui `<RouteGuard>` envolvendo `<AdminShell>`.

### 6b. Layout do grupo (public)

Criar `{DEST}/src/app/(public)/layout.tsx` a partir de
`assets/app/(public)/layout.template.tsx` **sem modificações**.

O template já trata `isAuthRoute` para a rota `/auth`.

### 6c. Página raiz com redirect

Criar `{DEST}/src/app/page.tsx`:

```tsx
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/principal');
}
```

### 6d. Página placeholder do módulo principal

Criar `{DEST}/src/app/(private)/principal/page.tsx`:

```tsx
export default function PrincipalPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Principal</h1>
      <p className="text-muted-foreground">Módulo em desenvolvimento.</p>
    </div>
  );
}
```

### 6e. Página de autenticação unificada

Criar `{DEST}/src/app/(public)/auth/page.tsx`:

```tsx
export default function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Autenticação — em desenvolvimento.</p>
    </div>
  );
}
```

---

## Fase 7 — Verificação final

```bash
ls {DEST}/src/shared/components/ui/sidebar-menu.component.tsx
ls {DEST}/src/shared/auth/route-guard.component.tsx
ls {DEST}/src/shared/navigation/app-modules.ts
ls {DEST}/src/shared/navigation/app-sidebar-navigation.component.tsx
ls {DEST}/src/app/(private)/layout.tsx
ls {DEST}/src/app/(public)/layout.tsx
ls {DEST}/src/app/page.tsx
ls {DEST}/src/app/(private)/principal/page.tsx
ls {DEST}/src/app/(public)/auth/page.tsx

# Verificar ausência de imports de pacotes de outros projetos (só `@mentoria-360/shared` é permitido)
grep -rE "from '@[a-z0-9-]+/" {DEST}/src/shared/ 2>/dev/null | grep -v "@mentoria-360/shared" | grep -v "@radix-ui/"
grep -r "@/modules/assistant" {DEST}/src/shared/ 2>/dev/null
```

---

## Fase 8 — Formatação

Após todos os arquivos serem criados/copiados, formatar o projeto com Prettier:

```bash
npm run format
```

Executar na raiz do monorepo para garantir que todos os arquivos `.ts`, `.tsx` e `.md` gerados seguem o estilo do projeto.

---

## Fase 9 — Relatório final

Exibir resumo estruturado:

```
✅ config-shared-frontend concluído para {APP_NAME}

📁 shared/ → {DEST}/src/shared/
   auth/route-guard.component.tsx              (guard de rota → /auth)
   components/branding/app-logo.component.tsx  (nome: {APP_NAME})
   components/ui/                              ({N} componentes)
   components/form/validator/                  (sistema de validação)
   context/shell.context.tsx
   hooks/
   i18n/                                       (pt + en)
   lib/class-name.util.ts
   navigation/
     app-modules.ts                            (1 módulo: principal)
     app-sidebar-navigation.component.tsx
     principal-routes.ts
   template/admin-shell.component.tsx + public-boxed-layout.component.tsx
   util/color.util.ts
   index.ts

🗺️  Rotas criadas:
   app/page.tsx                          → redirect /principal
   app/(private)/layout.tsx              → RouteGuard + ShellProvider + AdminShell
   app/(private)/principal/page.tsx      → placeholder
   app/(public)/layout.tsx               → PublicBoxedLayout (exceto /auth)
   app/(public)/auth/page.tsx            → placeholder de autenticação

⚠️  Próximos passos:
   1. Conectar RouteGuard ao mecanismo real de auth
      → apps/frontend/src/shared/auth/route-guard.component.tsx
   2. Instalar dependências se não existirem:
        lucide-react, recharts, @radix-ui/react-*, clsx, tailwind-merge
   3. Configurar globals.css com CSS vars do design system (--primary, --background, etc.)
   4. Renomear/adicionar módulos reais em app-modules.ts quando definidos
```

---

## Regras obrigatórias

- **Nunca** criar arquivos que importem de `@/modules/...` de outro projeto
- **Sempre** usar os assets embarcados em `<SKILLS_DIR>/config-shared-frontend/assets/` como fonte
- **Confirmar** antes de sobrescrever arquivos existentes no destino
- **Manter** todos os imports `@/shared/...` intactos — não alterar o sistema de alias
- **Não inventar** rotas ou módulos além dos defaults desta skill
- O `sidebar-menu.component.tsx` é o coração do sistema de navegação — nunca alterar sua lógica
- **Nunca perguntar** configuração ao usuário — resolver tudo pelos defaults da Fase 2
