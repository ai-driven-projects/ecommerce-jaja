#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = process.cwd()
const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const frontendDir = path.join(root, 'apps', 'frontend')
const srcDir = path.join(frontendDir, 'src')
const appDir = path.join(srcDir, 'app')
const sharedDir = path.join(srcDir, 'shared')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function writeFile(target, content) {
  ensureDir(path.dirname(target))
  fs.writeFileSync(target, content, 'utf8')
}

function copyDirContent(source, target) {
  ensureDir(target)
  const entries = fs.readdirSync(source, { withFileTypes: true })
  for (const entry of entries) {
    const from = path.join(source, entry.name)
    const to = path.join(target, entry.name)
    if (entry.isDirectory()) copyDirContent(from, to)
    else fs.copyFileSync(from, to)
  }
}

function getFrontendPkgName() {
  const pkg = JSON.parse(fs.readFileSync(path.join(frontendDir, 'package.json'), 'utf8'))
  return pkg.name
}

function toAppName(packageName) {
  const raw = packageName.includes('/') ? packageName.split('/').pop() : packageName
  return raw
    .split(/[-_]/g)
    .filter(Boolean)
    .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
    .join('')
}

function patchAppLogo(appName) {
  const logoPath = path.join(sharedDir, 'components', 'branding', 'app-logo.component.tsx')
  let content = fs.readFileSync(logoPath, 'utf8')
  content = content.replace(/const APP_NAME = '.*?';/, `const APP_NAME = '${appName}';`)
  fs.writeFileSync(logoPath, content, 'utf8')
}

function run(command) {
  execSync(command, { stdio: 'inherit', cwd: root })
}

function main() {
  if (!fs.existsSync(frontendDir)) {
    throw new Error('apps/frontend não encontrado. Execute config-project antes.')
  }

  const frontendPkg = getFrontendPkgName()
  const appName = toAppName(frontendPkg)
  const assets = path.join(skillDir, 'assets')

  run(
    `npm install lucide-react clsx tailwind-merge class-variance-authority radix-ui react-hook-form react-day-picker date-fns recharts sonner @radix-ui/react-checkbox @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-popover @radix-ui/react-radio-group @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-tabs --workspace ${frontendPkg}`,
  )

  copyDirContent(path.join(assets, 'shared'), sharedDir)
  patchAppLogo(appName)

  ensureDir(path.join(sharedDir, 'navigation'))
  fs.copyFileSync(
    path.join(assets, 'navigation', 'app-sidebar-navigation.template.tsx'),
    path.join(sharedDir, 'navigation', 'app-sidebar-navigation.component.tsx'),
  )

  writeFile(path.join(sharedDir, 'navigation', 'principal-routes.ts'), `export const PRINCIPAL_ROUTE = '/principal';\n`)
  writeFile(
    path.join(sharedDir, 'navigation', 'app-modules.ts'),
    `import { LayoutDashboard } from 'lucide-react';
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
  const activeModuleItem = getAppModuleItems().find((item) => pathname === item.href || pathname.startsWith(\`\${item.href}/\`));
  if (activeModuleItem) return sidebarStateByModuleId[activeModuleItem.id];
  return sidebarStateByModuleId.principal;
}
`,
  )

  ensureDir(path.join(appDir, '(private)'))
  ensureDir(path.join(appDir, '(public)'))
  ensureDir(path.join(appDir, '(private)', 'principal'))
  ensureDir(path.join(appDir, '(public)', 'auth'))

  fs.copyFileSync(path.join(assets, 'app', '(private)', 'layout.template.tsx'), path.join(appDir, '(private)', 'layout.tsx'))
  fs.copyFileSync(path.join(assets, 'app', '(public)', 'layout.template.tsx'), path.join(appDir, '(public)', 'layout.tsx'))

  writeFile(
    path.join(appDir, 'page.tsx'),
    `import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/principal');
}
`,
  )

  writeFile(
    path.join(appDir, '(private)', 'principal', 'page.tsx'),
    `export default function PrincipalPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Principal</h1>
      <p className="text-muted-foreground">Modulo em desenvolvimento.</p>
    </div>
  );
}
`,
  )

  writeFile(
    path.join(appDir, '(public)', 'auth', 'page.tsx'),
    `export default function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Autenticacao em desenvolvimento.</p>
    </div>
  );
}
`,
  )

  run('npm run format')
}

main()
