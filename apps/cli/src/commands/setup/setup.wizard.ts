import type { CommandContext, CommandResult, WizardStep } from '../../core/command.js';
import { wizard } from '../../core/wizard.js';
import { ensureDatabaseUp, inspectDatabase, isPrismaCliInstalled, migrateDevArgs, prisma, requireBackend } from '../db/lib.js';
import { ensureDockerRunning } from './docker.js';
import { buildProject, ensureEnvFiles, installDependencies, syncSubmodules } from './lib.js';

async function prismaStep(ctx: CommandContext, args: string[], okSummary: string): Promise<CommandResult> {
  requireBackend(ctx);
  if (ctx.dryRun) {
    ctx.report.info(`[dry-run] $ npx prisma ${args.join(' ')}`);
    return { status: 'ok', summary: 'Dry-run: nada executado' };
  }
  ctx.report.info(`npx prisma ${args.join(' ')}`);
  const result = await prisma(ctx, args);
  return result.ok ? { status: 'ok', summary: okSummary } : { status: 'error', summary: `prisma ${args.join(' ')} falhou (código ${result.code})` };
}

async function databaseReady(ctx: CommandContext): Promise<CommandResult> {
  if (await ensureDatabaseUp(ctx)) return { status: 'ok', summary: 'Banco pronto' };
  if (ctx.dryRun) return { status: 'ok', summary: 'Dry-run: banco não verificado a fundo' };
  // Sem Prisma CLI ainda (antes do install) a validação fica pendente; não é falha.
  if (!isPrismaCliInstalled(ctx)) return { status: 'warn', summary: 'Banco no ar; credenciais serão validadas após o install' };
  return { status: 'error', summary: 'Banco indisponível' };
}

async function requireDatabase(ctx: CommandContext, what: string): Promise<CommandResult | null> {
  if (ctx.dryRun) return null;
  const status = await inspectDatabase(ctx);
  if (status.credentialsValid === true) return null;
  return { status: 'error', summary: `Banco indisponível para ${what} (rode a etapa "Banco local")` };
}

export const setupSteps: WizardStep[] = [
  {
    id: 'env',
    label: 'Arquivos .env',
    description: 'Cria .env do backend e do frontend a partir dos .env.example e confere as chaves',
    defaultSelected: true,
    run: async (ctx) => {
      const { created, issues } = ensureEnvFiles(ctx);
      const summary = created === 0 ? 'Arquivos .env já existiam' : `${created} arquivo(s) criado(s)`;
      return issues > 0 ? { status: 'warn', summary: `${summary}; ${issues} pendência(s) para preencher` } : { status: 'ok', summary };
    },
  },
  {
    id: 'docker',
    label: 'Docker',
    description: 'Verifica se o Docker está no ar (no macOS abre o Docker Desktop se estiver parado)',
    defaultSelected: true,
    run: async (ctx) => {
      const status = await ensureDockerRunning(ctx);
      if (status.running) return { status: 'ok', summary: `Docker ${status.version}` };
      if (ctx.dryRun) return { status: 'ok', summary: 'Dry-run: Docker não verificado' };
      return { status: 'error', summary: status.installed ? 'Docker parado' : 'Docker não instalado' };
    },
  },
  {
    id: 'submodules',
    label: 'Submódulos git',
    description: 'git submodule sync/update, com fallback HTTPS → SSH',
    defaultSelected: true,
    continueOnError: true,
    run: async (ctx) => {
      const outcome = await syncSubmodules(ctx);
      if (outcome === 'failed') return { status: 'error', summary: 'Falha ao sincronizar submódulos' };
      return { status: 'ok', summary: outcome === 'skipped' ? 'Nada a sincronizar' : 'Submódulos sincronizados' };
    },
  },
  {
    id: 'install',
    label: 'Dependências',
    description: 'npm install na raiz do monorepo',
    defaultSelected: true,
    run: async (ctx) => ((await installDependencies(ctx)) ? { status: 'ok', summary: 'Dependências instaladas' } : { status: 'error', summary: 'npm install falhou' }),
  },
  {
    id: 'db',
    label: 'Banco local',
    description: 'Se a DATABASE_URL não responder, sobe o PostgreSQL com Docker Compose e valida as credenciais',
    defaultSelected: true,
    requires: ['env', 'docker'],
    run: databaseReady,
  },
  {
    id: 'generate',
    label: 'Prisma Client',
    description: 'npx prisma generate',
    defaultSelected: true,
    requires: ['install'],
    run: (ctx) => prismaStep(ctx, ['generate'], 'Prisma Client gerado'),
  },
  {
    id: 'build',
    label: 'Build',
    description: 'npm run build (turbo) em todos os pacotes',
    defaultSelected: true,
    requires: ['install', 'generate'],
    run: async (ctx) => ((await buildProject(ctx)) ? { status: 'ok', summary: 'Build concluído' } : { status: 'error', summary: 'Build falhou' }),
  },
  {
    id: 'reset',
    label: 'Resetar banco',
    description: 'npx prisma migrate reset --force (apaga todos os dados)',
    defaultSelected: false,
    requires: ['db', 'generate'],
    danger: 'Apaga TODOS os dados do banco local.',
    run: async (ctx) => (await requireDatabase(ctx, 'o reset')) ?? prismaStep(ctx, ['migrate', 'reset', '--force'], 'Banco resetado'),
  },
  {
    id: 'migrate',
    label: 'Migrations',
    description: 'npx prisma migrate dev (cria a migration inicial se ainda não existir nenhuma)',
    defaultSelected: true,
    requires: ['db', 'generate'],
    run: async (ctx) => (await requireDatabase(ctx, 'as migrations')) ?? prismaStep(ctx, migrateDevArgs(ctx), 'Migrations aplicadas'),
  },
  {
    id: 'seed',
    label: 'Seed',
    description: 'npx prisma db seed',
    defaultSelected: true,
    requires: ['migrate', 'build'],
    run: async (ctx) => (await requireDatabase(ctx, 'o seed')) ?? prismaStep(ctx, ['db', 'seed'], 'Seed concluído'),
  },
];

export const setupWizard = wizard({
  id: 'setup',
  title: 'Setup do ambiente local',
  description: 'Escolha o que preparar: .env, Docker, submódulos, dependências, banco, Prisma, build, migrations e seed',
  group: 'Ambiente local',
  icon: '🧰',
  keywords: ['inicial', 'bootstrap', 'onboarding', 'configurar', 'instalar', 'npm install', 'build', 'prisma', 'migrate', 'seed', 'env', 'docker'],
  steps: setupSteps,
});
