#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { SHARED_PACKAGE_NAME, resolveNamespace, resolveSkillPaths } from '../../utils/resolve-skill-config.mjs';
import { createSkillRunLogger } from '../../utils/skill-run-log.mjs';

let activeRunLogger = null;

const REQUIRED_CORE_FILES = [
  'package.json',
  'tsconfig.json',
  'jest.config.ts',
  'src/index.ts',
  'src/application/provider/user-exists.query.ts',
  'src/application/usecase/create-user.usecase.ts',
  'src/oauth/usecase/login-oauth.usecase.ts',
  'src/oauth/provider/oauth-auth.provider.ts',
  'src/password/provider/password.repository.ts',
  'src/password/usecase/change-password.usecase.ts',
  'src/role/usecase/create-role.usecase.ts',
  'src/permission/constants/permissions.ts',
  'src/user/provider/user.repository.ts',
  'src/user/usecase/assign-roles.usecase.ts',
  'src/user/usecase/login.usecase.ts',
  'test/oauth/login-oauth.usecase.test.ts',
  'test/role/create-role.usecase.test.ts',
  'test/permission/find-all-permissions.usecase.test.ts',
  'test/root/create-user.usecase.test.ts',
];

const REQUIRED_APPS_FILES = [
  'apps/backend/src/modules/auth/auth.controller.ts',
  'apps/backend/src/modules/auth/auth.module.ts',
  'apps/backend/src/modules/auth/providers/google-oauth.provider.ts',
  'apps/backend/src/modules/auth/oauth-account.prisma.ts',
  'apps/backend/prisma/models/auth.prisma',
  'apps/backend/src/db/prisma-transaction.context.ts',
  'apps/backend/src/db/prisma-transaction.manager.ts',
  'apps/backend/src/shared/guards/require-permission.guard.ts',
];

const GOOGLE_ENV_KEYS = [
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
  'FRONTEND_URL',
];

function usage() {
  console.log(`Usage:
  node create-auth-core-full.mjs [--scope @namespace] [--force] [--run-tests] [--target <path>] [--skip-apps] [--skip-apps-sync] [--skip-install]
  node create-auth-core-full.mjs --self-check

Examples:
  node create-auth-core-full.mjs
  node create-auth-core-full.mjs --scope @namespace --force
  node create-auth-core-full.mjs --force --run-tests
  node create-auth-core-full.mjs --skip-apps --skip-install
  node create-auth-core-full.mjs --self-check`);
}

function detectEol(content) {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

/** Append an import after the existing import block (EOL-preserving, idempotent). */
function ensureImportLine(content, importLine) {
  const line = importLine.replace(/\r?\n$/, '');
  if (content.includes(line)) return content;

  const eol = detectEol(content);
  const importBlockMatch = content.match(/^(import[^\n]*\n)+/m);
  if (importBlockMatch) {
    const block = importBlockMatch[0];
    return `${block}${line}${eol}${content.slice(block.length)}`;
  }

  return `${line}${eol}${content}`;
}

/** Wrap root `{children}` with `<AppProviders>` when missing (idempotent). */
function ensureAppProvidersWrap(content) {
  if (/<AppProviders[\s>]/.test(content)) return content;

  if (!/\{\s*children\s*\}/.test(content)) {
    throw new Error('Root layout.tsx has no {children} to wrap with AppProviders.');
  }

  return content.replace(/(\{\s*children\s*\})/, '<AppProviders>$1</AppProviders>');
}

/** Ensure `<Toaster />` sits inside AppProviders when the shared toaster exists. */
function ensureToasterInsideAppProviders(content) {
  const toasterImport = "import { Toaster } from '@/shared/components/ui/toaster';";
  let next = content;

  if (!/from ['"]@\/shared\/components\/ui\/toaster['"]/.test(next)) {
    next = ensureImportLine(next, toasterImport);
  }

  if (/<Toaster[\s/>]/.test(next)) return next;

  if (!/<\/AppProviders>/.test(next)) {
    throw new Error('Root layout.tsx missing </AppProviders> for Toaster insert.');
  }

  const eol = detectEol(next);
  return next.replace('</AppProviders>', `<Toaster />${eol}</AppProviders>`);
}

function patchRootLayoutContent(content, { includeToaster = true } = {}) {
  let next = ensureImportLine(content, "import { AppProviders } from './providers';");
  next = ensureAppProvidersWrap(next);
  if (includeToaster) {
    next = ensureToasterInsideAppProviders(next);
  }
  return next;
}

async function ensureAppProvidersInRootLayout(frontendDst) {
  const layoutPath = path.join(frontendDst, 'src/app/layout.tsx');
  const providersPath = path.join(frontendDst, 'src/app/providers.tsx');

  if (!(await exists(layoutPath))) {
    throw new Error(`Root layout not found: ${layoutPath}`);
  }
  if (!(await exists(providersPath))) {
    throw new Error(`providers.tsx not found (required for AuthProvider): ${providersPath}`);
  }

  const toasterPath = path.join(frontendDst, 'src/shared/components/ui/toaster.tsx');
  const includeToaster = await exists(toasterPath);

  const before = await fs.readFile(layoutPath, 'utf8');
  const next = patchRootLayoutContent(before, { includeToaster });

  if (next !== before) {
    await fs.writeFile(layoutPath, next, 'utf8');
    activeRunLogger?.step(
      includeToaster
        ? 'layout.tsx raiz atualizado com AppProviders + Toaster (patch idempotente).'
        : 'layout.tsx raiz atualizado com AppProviders (patch idempotente).',
    );
  } else {
    activeRunLogger?.step('layout.tsx raiz já contém AppProviders.');
  }
}

function runSelfCheck() {
  const line = "import { AppProviders } from './providers';";
  const lf = "import { Geist } from 'next/font/google';\n\nexport default function RootLayout({ children }) {\n  return <html><body>{children}</body></html>;\n}\n";
  const crlf = lf.replace(/\n/g, '\r\n');

  for (const [label, sample] of [
    ['lf', lf],
    ['crlf', crlf],
  ]) {
    const once = patchRootLayoutContent(sample, { includeToaster: true });
    if (!once.includes(line)) {
      throw new Error(`self-check fail (${label}): missing AppProviders import`);
    }
    if (!/<AppProviders>\{\s*children\s*\}/.test(once) || !/<\/AppProviders>/.test(once)) {
      throw new Error(`self-check fail (${label}): children not wrapped`);
    }
    if (!once.includes('<Toaster />')) {
      throw new Error(`self-check fail (${label}): missing Toaster`);
    }
    if (label === 'crlf' && !once.includes(`from './providers';\r\n`)) {
      throw new Error('self-check fail (crlf): import EOL not preserved');
    }
    const twice = patchRootLayoutContent(once, { includeToaster: true });
    if (twice !== once) {
      throw new Error(`self-check fail (${label}): patch not idempotent`);
    }
  }

  console.log('confg-auth-core-full self-check ok');
}

function parseArgs(argv) {
  let scope = '';
  let force = false;
  let runTests = false;
  let target = '';
  let skipApps = false;
  let skipAppsSync = false;
  let skipInstall = false;
  let selfCheck = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }

    if (arg === '--self-check') {
      selfCheck = true;
      continue;
    }

    if (arg === '--force') {
      force = true;
      continue;
    }

    if (arg === '--run-tests') {
      runTests = true;
      continue;
    }

    if (arg === '--skip-apps') {
      skipApps = true;
      continue;
    }

    if (arg === '--skip-apps-sync') {
      skipAppsSync = true;
      continue;
    }

    if (arg === '--skip-install') {
      skipInstall = true;
      continue;
    }

    if (arg === '--scope') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --scope');
      scope = value;
      i += 1;
      continue;
    }

    if (arg === '--target') {
      const value = argv[i + 1];
      if (!value) throw new Error('Missing value for --target');
      target = value;
      i += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return { scope, force, runTests, target, skipApps, skipAppsSync, skipInstall, selfCheck };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveTarget(rootDir, targetArg) {
  return path.isAbsolute(targetArg) ? targetArg : path.resolve(rootDir, targetArg);
}

function isSamePath(a, b) {
  return path.resolve(a) === path.resolve(b);
}

function ensureSafeOverwriteTarget(rootDir, targetDir) {
  const resolvedTarget = path.resolve(targetDir);
  const resolvedRoot = path.resolve(rootDir);
  const rootBoundary = path.parse(resolvedTarget).root;

  if (resolvedTarget === rootBoundary) {
    throw new Error(`Refusing to overwrite filesystem root with --force: ${targetDir}`);
  }

  if (resolvedTarget === resolvedRoot) {
    throw new Error(`Refusing to overwrite repository root with --force: ${targetDir}`);
  }
}

function normalizeWorkspacePatterns(workspaces) {
  if (Array.isArray(workspaces)) return workspaces;
  if (workspaces && typeof workspaces === 'object' && Array.isArray(workspaces.packages)) {
    return workspaces.packages;
  }
  return [];
}

function normalizePattern(pattern) {
  if (typeof pattern !== 'string') return '';
  return pattern.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

async function resolveWorkspacePatterns(rootDir) {
  const rootPackageJsonPath = path.join(rootDir, 'package.json');
  if (!(await exists(rootPackageJsonPath))) return [];

  try {
    const rootPkg = await readJson(rootPackageJsonPath);
    return normalizeWorkspacePatterns(rootPkg.workspaces)
      .map((pattern) => normalizePattern(pattern))
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function resolveDefaultAuthCoreTarget({ rootDir }) {
  const modulesDir = path.join(rootDir, 'modules');
  const [workspacePatterns, authModuleExists] = await Promise.all([
    resolveWorkspacePatterns(rootDir),
    exists(path.join(modulesDir, 'auth', 'package.json')),
  ]);

  if (!workspacePatterns.includes('modules/*') && !authModuleExists) {
    activeRunLogger?.step(
      'Workspace modules/* ainda nao detectado; usando modules/auth como alvo padrao da arquitetura.',
    );
  }

  return path.join(modulesDir, 'auth');
}

function runCommand(cmd, args, cwd) {
  activeRunLogger?.command(cmd, args);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${cmd} ${args.join(' ')} (exit ${code})`));
    });
  });
}

async function ensureDependencyInApp({ packageJsonPath, dependencyName, loggerLabel }) {
  if (!(await exists(packageJsonPath))) {
    activeRunLogger?.step(`${loggerLabel} não encontrado: ${packageJsonPath}.`);
    return false;
  }

  const packageJson = await readJson(packageJsonPath);
  const dependencies = { ...(packageJson.dependencies ?? {}) };

  if (dependencies[dependencyName] === '*') {
    activeRunLogger?.step(`${loggerLabel} já possui dependência ${dependencyName}@*.`);
    return false;
  }

  dependencies[dependencyName] = '*';
  packageJson.dependencies = dependencies;
  await writeJson(packageJsonPath, packageJson);
  activeRunLogger?.step(`${loggerLabel} atualizado com dependência ${dependencyName}@*.`);
  return true;
}

async function ensureBackendAuthDependencies(backendPackageJsonPath, authPackageName) {
  if (!(await exists(backendPackageJsonPath))) {
    activeRunLogger?.step(`Backend package.json não encontrado: ${backendPackageJsonPath}.`);
    return false;
  }

  const pkg = await readJson(backendPackageJsonPath);
  const dependencies = {
    ...(pkg.dependencies ?? {}),
    [authPackageName]: '*',
    '@nestjs/jwt': '^11.0.1',
    '@nestjs/passport': '^11.0.5',
    bcrypt: '^6.0.0',
    passport: '^0.7.0',
    'passport-jwt': '^4.0.1',
  };
  const devDependencies = {
    ...(pkg.devDependencies ?? {}),
    '@types/bcrypt': '^6.0.0',
    '@types/passport': '^1.0.17',
    '@types/passport-jwt': '^4.0.1',
  };

  const changed =
    JSON.stringify(pkg.dependencies ?? {}) !== JSON.stringify(dependencies) ||
    JSON.stringify(pkg.devDependencies ?? {}) !== JSON.stringify(devDependencies);

  if (!changed) {
    activeRunLogger?.step('Deps JWT/Passport/bcrypt já presentes no backend.');
    return false;
  }

  await writeJson(backendPackageJsonPath, { ...pkg, dependencies, devDependencies });
  activeRunLogger?.step('Deps JWT/Passport/bcrypt sincronizadas no backend.');
  return true;
}

async function replaceTokenRecursively({ targetDir, token, replacement }) {
  const stack = [targetDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      const ext = path.extname(entry.name);
      if (!['.ts', '.tsx', '.json', '.md', '.prisma', '.example', '.http'].includes(ext)) {
        continue;
      }

      const content = await fs.readFile(fullPath, 'utf8');
      if (!content.includes(token)) continue;
      await fs.writeFile(fullPath, content.split(token).join(replacement), 'utf8');
    }
  }
}

async function ensureTemplateContract(templateDir, requiredFiles, label) {
  const missingFiles = [];
  for (const relativePath of requiredFiles) {
    if (!(await exists(path.join(templateDir, relativePath)))) {
      missingFiles.push(relativePath);
    }
  }

  if (missingFiles.length > 0) {
    throw new Error(
      `${label} template contract broken. Missing required files: ${missingFiles.join(', ')}`,
    );
  }
}

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

async function updateTsConfigExtends({ targetDir, packagesDir }) {
  const tsconfigPath = path.join(targetDir, 'tsconfig.json');
  if (!(await exists(tsconfigPath))) return null;

  const tsconfig = await readJson(tsconfigPath);
  const typescriptBasePath = path.join(packagesDir, 'typescript-config', 'base.json');
  let extendsPath = toPosixPath(path.relative(targetDir, typescriptBasePath));
  if (!extendsPath.startsWith('.')) extendsPath = `./${extendsPath}`;
  tsconfig.extends = extendsPath;
  await writeJson(tsconfigPath, tsconfig);
  return extendsPath;
}

async function copyDirContents(sourceDir, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(sourceDir, entry.name);
    const to = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await fs.cp(from, to, { recursive: true, force: true });
    } else {
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
    }
  }
}

async function mergeEnvExample({ rootDir, appsTemplateDir }) {
  const snippetPath = path.join(appsTemplateDir, 'apps/backend/auth.env.example');
  if (!(await exists(snippetPath))) return;

  const snippet = await fs.readFile(snippetPath, 'utf8');
  const snippetLines = snippet
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = [
    path.join(rootDir, 'apps/backend/.env.example'),
    path.join(rootDir, 'apps/backend/.env'),
  ];

  for (const envPath of candidates) {
    if (!(await exists(envPath))) continue;

    const current = await fs.readFile(envPath, 'utf8');
    const missing = snippetLines.filter((line) => {
      const key = line.split('=')[0];
      return key && !current.includes(`${key}=`);
    });

    if (missing.length === 0) {
      activeRunLogger?.step(`Env já contém chaves Google/JWT: ${path.basename(envPath)}.`);
      continue;
    }

    const next = `${current.trimEnd()}\n\n# Auth / Google OAuth\n${missing.join('\n')}\n`;
    await fs.writeFile(envPath, next, 'utf8');
    activeRunLogger?.step(`Env atualizado com chaves Google/JWT: ${path.basename(envPath)}.`);
  }

  // Always ensure .env.example exists with required keys when neither file had them
  const examplePath = path.join(rootDir, 'apps/backend/.env.example');
  if (!(await exists(examplePath))) {
    await fs.mkdir(path.dirname(examplePath), { recursive: true });
    await fs.writeFile(examplePath, `${snippet.trimEnd()}\n`, 'utf8');
    activeRunLogger?.step('Criado apps/backend/.env.example com chaves Google/JWT.');
  }
}

async function ensureAuthModuleImported(appModulePath) {
  if (!(await exists(appModulePath))) {
    activeRunLogger?.step(`app.module.ts não encontrado: ${appModulePath}.`);
    return false;
  }

  let content = await fs.readFile(appModulePath, 'utf8');
  let next = content;

  const importPath = './modules/auth/auth.module';
  const importLine = `import { AuthModule } from '${importPath}';`;
  const hasImport = next.includes(`from '${importPath}'`) || next.includes(`from "${importPath}"`);

  if (!hasImport) {
    const importBlockMatch = next.match(/^(import[^\n]*\n)+/m);
    if (importBlockMatch) {
      next = `${importBlockMatch[0]}${importLine}\n${next.slice(importBlockMatch[0].length)}`;
    } else {
      next = `${importLine}\n${next}`;
    }
  }

  const importsRegex = /imports:\s*\[([\s\S]*?)\]/m;
  const importsMatch = next.match(importsRegex);
  if (importsMatch && !/\bAuthModule\b/.test(importsMatch[1])) {
    const inner = importsMatch[1];
    const replacement = inner.trim().length === 0 ? '\n    AuthModule,\n  ' : `\n    AuthModule,${inner}`;
    next = next.replace(importsRegex, `imports: [${replacement}]`);
  }

  if (next === content) {
    activeRunLogger?.step('AuthModule já registrado em app.module.ts.');
    return false;
  }

  await fs.writeFile(appModulePath, next, 'utf8');
  activeRunLogger?.step('AuthModule registrado em app.module.ts.');
  return true;
}

async function ensureAuthSeed(rootDir) {
  const seedTaskSrc = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../assets/auth-full-apps-template/apps/backend/prisma/seed/tasks/auth.seed.ts',
  );
  const seedTaskDst = path.join(rootDir, 'apps/backend/prisma/seed/tasks/auth.seed.ts');
  const seedMainPath = path.join(rootDir, 'apps/backend/prisma/seed/main.ts');

  if (!(await exists(seedTaskSrc))) {
    activeRunLogger?.step('Seed auth template ausente; pulando seed.');
    return;
  }

  await fs.mkdir(path.dirname(seedTaskDst), { recursive: true });
  await fs.copyFile(seedTaskSrc, seedTaskDst);
  activeRunLogger?.step('Seed auth copiado para prisma/seed/tasks/auth.seed.ts.');

  if (!(await exists(seedMainPath))) {
    activeRunLogger?.step('prisma/seed/main.ts ausente; pulando registro do seed.');
    return;
  }

  let content = await fs.readFile(seedMainPath, 'utf8');
  let next = content;
  const importLine = "import { seedAuthDefaultUsers } from './tasks/auth.seed';";

  if (!next.includes(importLine)) {
    const prismaImportRegex = /import \{ PrismaClient \} from '@prisma\/client';\n/;
    if (prismaImportRegex.test(next)) {
      next = next.replace(
        prismaImportRegex,
        `import { PrismaClient } from '@prisma/client';\n${importLine}\n`,
      );
    } else {
      next = `${importLine}\n${next}`;
    }
  }

  const seedTasksRegex = /const seedTasks: SeedTask\[] = \[([\s\S]*?)\];/m;
  const seedTasksMatch = next.match(seedTasksRegex);
  if (seedTasksMatch) {
    if (!seedTasksMatch[1].includes('seedAuthDefaultUsers')) {
      const updatedContent =
        seedTasksMatch[1].trim().length === 0
          ? '\n  seedAuthDefaultUsers,\n'
          : `\n  seedAuthDefaultUsers,${seedTasksMatch[1]}`;
      next = next.replace(seedTasksRegex, `const seedTasks: SeedTask[] = [${updatedContent}];`);
    }
  }

  if (next !== content) {
    await fs.writeFile(seedMainPath, next, 'utf8');
    activeRunLogger?.step('seedAuthDefaultUsers registrado em prisma/seed/main.ts.');
  }
}

async function adaptWebBasicFrontendForAuthFull(frontendDst) {
  const authModuleDir = path.join(frontendDst, 'src/modules/auth');
  if (!(await exists(authModuleDir))) return;

  // Shared atual exporta Url (nao URL).
  const schemaFiles = [
    'data/create-user.schema.ts',
    'data/edit-user.schema.ts',
    'pages/profile.page.tsx',
  ];
  for (const relativePath of schemaFiles) {
    const filePath = path.join(authModuleDir, relativePath);
    if (!(await exists(filePath))) continue;
    let content = await fs.readFile(filePath, 'utf8');
    const next = content
      .replace(/\{([^}]*)\bURL\b([^}]*)\} from ['"]([^'"]+)['"]/g, '{$1Url$2} from \'$3\'')
      .replace(/vo:\s*URL\b/g, 'vo: Url')
      .replace(/\bURL\.create\b/g, 'Url.create')
      .replace(/\bURL\.tryCreate\b/g, 'Url.tryCreate');
    if (next !== content) {
      await fs.writeFile(filePath, next, 'utf8');
    }
  }

  const signInPath = path.join(authModuleDir, 'pages/sign-in.page.tsx');
  if (!(await exists(signInPath))) return;

  let signIn = await fs.readFile(signInPath, 'utf8');
  if (signIn.includes('/auth/google/start')) {
    activeRunLogger?.step('Botão Google já presente no sign-in.');
    return;
  }

  const googleBlock = `
        <a
          href={\`\${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/auth/google/start\`}
          className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Continuar com Google
        </a>
`;

  if (signIn.includes('</form>')) {
    signIn = signIn.replace('</form>', `</form>\n${googleBlock}`);
    await fs.writeFile(signInPath, signIn, 'utf8');
    activeRunLogger?.step('Botão Google OAuth adicionado ao sign-in (web-basic).');
  }
}

async function applyAppsTemplate({ rootDir, appsTemplateDir, authPackageName, sharedPackageName }) {
  const backendSrc = path.join(appsTemplateDir, 'apps/backend');
  const frontendSrc = path.join(appsTemplateDir, 'apps/frontend');
  const backendDst = path.join(rootDir, 'apps/backend');
  const frontendDst = path.join(rootDir, 'apps/frontend');
  const skillsRootDir = path.resolve(appsTemplateDir, '../../..');
  const webBasicFrontend = path.join(
    skillsRootDir,
    'config-auth-web-basic/assets/config-auth-web-basic-template/apps/frontend',
  );

  if (await exists(backendSrc)) {
    // module files
    await fs.cp(
      path.join(backendSrc, 'src/modules/auth'),
      path.join(backendDst, 'src/modules/auth'),
      { recursive: true, force: true },
    );

    // infra used by auth adapters (do not overwrite prisma.service from config-prisma)
    for (const relativePath of [
      'src/db/prisma-transaction.context.ts',
      'src/db/prisma-transaction.manager.ts',
      'src/errors/index.ts',
      'src/shared/decorators/current-user.decorator.ts',
      'src/shared/decorators/require-permission.decorator.ts',
      'src/shared/guards/require-permission.guard.ts',
    ]) {
      const from = path.join(backendSrc, relativePath);
      if (!(await exists(from))) continue;
      const to = path.join(backendDst, relativePath);
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.copyFile(from, to);
    }

    if (await exists(path.join(backendSrc, 'prisma/models'))) {
      await fs.mkdir(path.join(backendDst, 'prisma/models'), { recursive: true });
      await copyDirContents(
        path.join(backendSrc, 'prisma/models'),
        path.join(backendDst, 'prisma/models'),
      );
    }

    if (await exists(path.join(backendSrc, 'prisma/migrations'))) {
      await fs.mkdir(path.join(backendDst, 'prisma/migrations'), { recursive: true });
      await copyDirContents(
        path.join(backendSrc, 'prisma/migrations'),
        path.join(backendDst, 'prisma/migrations'),
      );
    }

    activeRunLogger?.step('Backend auth (Nest + Prisma + Google OAuth) aplicado.');
    await ensureAuthModuleImported(path.join(backendDst, 'src/app.module.ts'));
    await ensureAuthSeed(rootDir);
  }

  if (await exists(frontendSrc) || (await exists(webBasicFrontend))) {
    // O template frontend full legado nao casa com config-shared-frontend.
    // Preferir template alinhado do config-auth-web-basic.
    const effectiveFrontendSrc = (await exists(webBasicFrontend))
      ? webBasicFrontend
      : frontendSrc;

    await fs.cp(
      path.join(effectiveFrontendSrc, 'src/modules/auth'),
      path.join(frontendDst, 'src/modules/auth'),
      { recursive: true, force: true },
    );

    // (private)/layout.tsx substitui o RouteGuard do config-shared-frontend
    // (auth_token) pelo PrivateRoute do auth (useAuth) — evita loop
    // /auth/sign-in ↔ /dashboard com chaves de token diferentes.
    for (const relativeAppPath of [
      'src/app/(public)/auth',
      'src/app/(private)/layout.tsx',
      'src/app/(private)/auth',
      'src/app/(private)/dashboard',
      'src/app/providers.tsx',
    ]) {
      const from = path.join(effectiveFrontendSrc, relativeAppPath);
      if (!(await exists(from))) continue;
      const to = path.join(frontendDst, relativeAppPath);
      await fs.cp(from, to, { recursive: true, force: true });
    }

    // (public)/(private) nao entram na URL — /auth colide se ambos tiverem page.tsx
    // (placeholder do config-shared-frontend sobra no fs.cp merge).
    const publicAuthPage = path.join(frontendDst, 'src/app/(public)/auth/page.tsx');
    const privateAuthPage = path.join(frontendDst, 'src/app/(private)/auth/page.tsx');
    if ((await exists(publicAuthPage)) && (await exists(privateAuthPage))) {
      await fs.rm(publicAuthPage, { force: true });
      activeRunLogger?.step('Removido (public)/auth/page.tsx para evitar colisão com (private)/auth.');
      activeRunLogger?.risk('exclusao: apps/frontend/src/app/(public)/auth/page.tsx (colisao /auth)');
    }

    const legacyPages = path.join(frontendDst, 'src/app/(pages)');
    if (await exists(legacyPages)) {
      await fs.rm(legacyPages, { recursive: true, force: true });
    }

    activeRunLogger?.step(
      `Frontend auth aplicado via ${path.relative(skillsRootDir, effectiveFrontendSrc) || effectiveFrontendSrc}.`,
    );

    await adaptWebBasicFrontendForAuthFull(frontendDst);
    await ensureAppProvidersInRootLayout(frontendDst);
  }

  const tokenTargets = [
    path.join(backendDst, 'src/modules/auth'),
    path.join(backendDst, 'src/db'),
    path.join(backendDst, 'src/errors'),
    path.join(backendDst, 'src/shared'),
    path.join(frontendDst, 'src/modules/auth'),
    path.join(frontendDst, 'src/app'),
  ];

  // Templates usam placeholders __TOKEN__; os literais @namespace/* ficam como fallback.
  const scopeSlug = authPackageName.includes('/')
    ? authPackageName.slice(1).split('/')[0]
    : 'namespace';
  const tokenReplacements = [
    ['__AUTH_PACKAGE_NAME__', authPackageName],
    ['__SHARED_PACKAGE_NAME__', sharedPackageName],
    ['__PROJECT_SCOPE_SLUG__', scopeSlug],
    ['@namespace/auth', authPackageName],
    ['namespace.access_token', `${scopeSlug}.access_token`],
  ];

  for (const targetDir of tokenTargets) {
    if (!(await exists(targetDir))) continue;
    for (const [token, replacement] of tokenReplacements) {
      await replaceTokenRecursively({ targetDir, token, replacement });
    }
  }

  await mergeEnvExample({ rootDir, appsTemplateDir });
}

async function main() {
  const {
    scope: scopeArg,
    force,
    runTests,
    target,
    skipApps,
    skipAppsSync,
    skipInstall,
    selfCheck,
  } = parseArgs(process.argv.slice(2));

  if (selfCheck) {
    runSelfCheck();
    return;
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const skillDir = path.resolve(scriptDir, '..');
  const coreTemplateDir = path.join(skillDir, 'assets', 'auth-core-full-template');
  const appsTemplateDir = path.join(skillDir, 'assets', 'auth-full-apps-template');
  // Repo root = cwd (igual create-shared). Nao derivar de skillDir: com skills
  // linkadas/junction o caminho fisico da skill fica fora do monorepo.
  const rootDir = process.cwd();
  const logger = await createSkillRunLogger({
    rootDir,
    skillName: 'confg-auth-core-full',
    commandArgs: process.argv.slice(2),
  });

  try {
    activeRunLogger = logger;

    const { packagesDir, sharedModule, sharedPackageJsonPath, config } =
      await resolveSkillPaths(rootDir);
    const defaultTargetDir = await resolveDefaultAuthCoreTarget({ rootDir });
    const targetDir = target ? resolveTarget(rootDir, target) : defaultTargetDir;
    const targetPackageJsonPath = path.join(targetDir, 'package.json');

    logger.step(`Diretório alvo resolvido: ${targetDir}.`);

    if (!(await exists(coreTemplateDir))) {
      throw new Error(`Template directory not found: ${coreTemplateDir}`);
    }
    await ensureTemplateContract(coreTemplateDir, REQUIRED_CORE_FILES, 'Auth core full');
    logger.step('Contrato mínimo do template core validado com sucesso.');

    if (!skipApps) {
      if (!(await exists(appsTemplateDir))) {
        throw new Error(`Apps template directory not found: ${appsTemplateDir}`);
      }
      await ensureTemplateContract(appsTemplateDir, REQUIRED_APPS_FILES, 'Auth full apps');
      logger.step('Contrato mínimo do template apps (backend/frontend/Google) validado.');
    }

    if (await exists(targetDir)) {
      if (!force) {
        throw new Error(`Target directory already exists: ${targetDir}. Use --force to overwrite.`);
      }
      ensureSafeOverwriteTarget(rootDir, targetDir);
      await fs.rm(targetDir, { recursive: true, force: true });
      logger.step(`Diretório existente removido com --force: ${targetDir}.`);
    }

    await fs.mkdir(path.dirname(targetDir), { recursive: true });
    await fs.cp(coreTemplateDir, targetDir, { recursive: true });
    logger.step('Template do módulo auth full copiado para o diretório alvo.');

    const tsconfigExtendsPath = await updateTsConfigExtends({
      targetDir,
      packagesDir,
    });
    if (tsconfigExtendsPath) {
      logger.step(`tsconfig.extends ajustado para ${tsconfigExtendsPath}.`);
    }

    const pkg = await readJson(targetPackageJsonPath);
    const templateScope =
      typeof pkg.name === 'string' && pkg.name.includes('/')
        ? pkg.name.split('/')[0]
        : '@namespace';

    const { scope } = await resolveNamespace({
      rootDir,
      cliScope: scopeArg,
      fallbackScope: templateScope,
    });
    logger.step(`Namespace resolvido: ${scope}.`);

    pkg.name = `${scope}/auth`;
    const dependencies = { ...(pkg.dependencies ?? {}) };

    // O shared é um submódulo externo com escopo próprio; não segue o namespace do projeto.
    const sharedPackageName = SHARED_PACKAGE_NAME;

    delete dependencies.__SHARED_PACKAGE_NAME__;
    delete dependencies.__AUTH_PACKAGE_NAME__;
    dependencies[sharedPackageName] = '*';
    pkg.dependencies = dependencies;
    await writeJson(targetPackageJsonPath, pkg);

    const authPackageName = pkg.name;

    await replaceTokenRecursively({
      targetDir,
      token: '__SHARED_PACKAGE_NAME__',
      replacement: sharedPackageName,
    });
    await replaceTokenRecursively({
      targetDir,
      token: '__AUTH_PACKAGE_NAME__',
      replacement: authPackageName,
    });

    logger.step(`Nome do pacote atualizado para ${pkg.name}.`);
    logger.step(`Dependência shared configurada para ${sharedPackageName}.`);

    if (!skipApps) {
      await applyAppsTemplate({
        rootDir,
        appsTemplateDir,
        authPackageName,
        sharedPackageName,
      });
      logger.step(
        `Apps auth aplicados (Google OAuth keys: ${GOOGLE_ENV_KEYS.join(', ')}).`,
      );
    } else {
      logger.step('Aplicação de backend/frontend ignorada por --skip-apps.');
    }

    let appsUpdated = false;
    if (!skipAppsSync) {
      const authDependencyName = pkg.name;
      const backendPackageJsonPath = path.join(
        rootDir,
        config.defaults.backendAppPath,
        'package.json',
      );
      const frontendPackageJsonPath = path.join(
        rootDir,
        config.defaults.frontendAppPath,
        'package.json',
      );

      const [backendChanged, frontendChanged] = await Promise.all([
        ensureBackendAuthDependencies(backendPackageJsonPath, authDependencyName),
        ensureDependencyInApp({
          packageJsonPath: frontendPackageJsonPath,
          dependencyName: authDependencyName,
          loggerLabel: 'Frontend',
        }),
      ]);

      appsUpdated = backendChanged || frontendChanged;
      if (!appsUpdated) {
        logger.step('Dependências backend/frontend já estavam convergentes.');
      }
    } else {
      logger.step('Sincronização de apps ignorada por --skip-apps-sync.');
    }

    console.log(`Auth core full module created at: ${targetDir}`);
    console.log(`Package name: ${pkg.name}`);
    if (!skipApps) {
      console.log('Backend + frontend auth (incl. Google OAuth) applied.');
    }

    const shouldRunWorkspaceTests = isSamePath(targetDir, defaultTargetDir);
    if (runTests) {
      console.log(`Running tests for ${pkg.name}...`);
      if (shouldRunWorkspaceTests) {
        await runCommand('npm', ['run', 'test', '-w', pkg.name], rootDir);
        logger.step(`Testes executados para ${pkg.name}.`);
      } else {
        console.log(
          `Skipping tests for custom target ${targetDir} (workspace test execution is supported only on the default target).`,
        );
        logger.step(
          `Testes ignorados para target customizado (${targetDir}); execução suportada apenas no alvo padrão do workspace.`,
        );
      }
    } else {
      logger.step('Execução de testes não solicitada.');
    }

    if (!skipInstall) {
      console.log('Running npm install at repository root...');
      await runCommand('npm', ['install'], rootDir);
      logger.step('npm install executado no root para atualizar lock/dependências.');
    } else {
      logger.step('Instalação de dependências ignorada por --skip-install.');
    }

    await logger.success();
  } catch (error) {
    await logger.failure(error);
    throw error;
  } finally {
    activeRunLogger = null;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
