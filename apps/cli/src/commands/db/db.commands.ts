import type { Command } from '../../core/command.js';
import { menu } from '../../core/wizard.js';
import { compose, describeTarget, ensureDatabaseUp, inspectDatabase, migrateDevArgs, prisma, prismaCommand, requireBackend } from './lib.js';

export const dbStatus: Command = {
  id: 'db:status',
  title: 'Status do banco',
  description: 'Mostra se a DATABASE_URL responde e se as credenciais são válidas',
  group: 'Banco',
  keywords: ['postgres', 'conexao', 'ping'],
  async run(ctx) {
    const status = await inspectDatabase(ctx);
    const where = describeTarget(status.target);
    ctx.report.info(`DATABASE_URL → ${where} (${status.target.isLocal ? 'local' : 'remoto'})`);
    if (!status.portOpen) {
      ctx.report.warn('Porta fechada.');
      return { status: 'warn', summary: `Banco fora do ar em ${where}` };
    }
    ctx.report.success('Porta aberta.');
    if (status.credentialsValid === null) {
      ctx.report.warn('Prisma CLI não instalado; credenciais não validadas.');
      return { status: 'warn', summary: 'Porta aberta, credenciais não validadas' };
    }
    if (!status.credentialsValid) {
      ctx.report.error('Credenciais da DATABASE_URL rejeitadas.');
      return { status: 'error', summary: 'Credenciais inválidas' };
    }
    ctx.report.success('Credenciais válidas.');
    return { status: 'ok', summary: `Banco ok em ${where}` };
  },
};

export const dbStart: Command = {
  id: 'db:start',
  title: 'Subir banco local',
  description: 'Sobe o PostgreSQL com Docker Compose (se preciso) e valida a DATABASE_URL',
  group: 'Banco',
  keywords: ['postgres', 'docker', 'up', 'iniciar'],
  async run(ctx) {
    const ready = await ensureDatabaseUp(ctx);
    if (ctx.dryRun) return { status: 'ok', summary: 'Dry-run concluído' };
    return ready ? { status: 'ok', summary: 'Banco pronto' } : { status: 'warn', summary: 'Banco subiu com ressalvas, veja os avisos' };
  },
};

export const dbStop: Command = {
  id: 'db:stop',
  title: 'Parar banco local',
  description: 'Para o container do PostgreSQL (dados são mantidos no volume)',
  group: 'Banco',
  keywords: ['postgres', 'docker', 'stop', 'parar'],
  async run(ctx) {
    if (ctx.dryRun) {
      ctx.report.info('[dry-run] $ docker compose stop postgres');
      return { status: 'ok', summary: 'Dry-run: nada executado' };
    }
    const result = await compose(ctx, ['stop', 'postgres']);
    return result.ok ? { status: 'ok', summary: 'PostgreSQL parado' } : { status: 'error', summary: 'docker compose stop postgres falhou' };
  },
};

export const dbLogs: Command = {
  id: 'db:logs',
  title: 'Logs do banco',
  description: 'Acompanha os logs do PostgreSQL local (Esc encerra)',
  group: 'Banco',
  keywords: ['postgres', 'docker', 'log'],
  async run(ctx) {
    const result = await compose(ctx, ['logs', '--tail', '100', '-f', 'postgres']);
    if (ctx.signal.aborted) return { status: 'ok', summary: 'Logs encerrados' };
    return result.ok ? { status: 'ok', summary: 'Logs encerrados' } : { status: 'error', summary: 'Não foi possível ler os logs' };
  },
};

export const dbGenerate = prismaCommand({ id: 'db:generate', title: 'Gerar Prisma Client', description: 'npx prisma generate', keywords: ['client', 'generate'], args: ['generate'] });

export const dbMigrate = prismaCommand({
  id: 'db:migrate',
  title: 'Aplicar migrations (dev)',
  description: 'npx prisma migrate dev (cria a migration inicial se não houver nenhuma)',
  keywords: ['migration', 'migrate', 'schema'],
  args: migrateDevArgs,
  needsDatabase: true,
});

export const dbSeed = prismaCommand({ id: 'db:seed', title: 'Popular banco (seed)', description: 'npx prisma db seed', keywords: ['seed', 'dados', 'popular'], args: ['db', 'seed'], needsDatabase: true });

export const dbReset = prismaCommand({
  id: 'db:reset',
  title: 'Resetar banco',
  description: 'npx prisma migrate reset --force (apaga todos os dados)',
  keywords: ['reset', 'apagar', 'limpar', 'drop'],
  args: ['migrate', 'reset', '--force'],
  needsDatabase: true,
  confirm: 'Isso apaga TODOS os dados do banco e reaplica as migrations. Continuar?',
});

export const dbStudio: Command = {
  id: 'db:studio',
  title: 'Prisma Studio',
  description: 'Abre o Prisma Studio no navegador (Esc encerra)',
  group: 'Banco',
  keywords: ['prisma', 'studio', 'navegador', 'browser'],
  async run(ctx) {
    requireBackend(ctx);
    const result = await prisma(ctx, ['studio']);
    if (ctx.signal.aborted) return { status: 'ok', summary: 'Prisma Studio encerrado' };
    return result.ok ? { status: 'ok', summary: 'Prisma Studio encerrado' } : { status: 'error', summary: 'Prisma Studio falhou' };
  },
};

export const dbMenu: Command = menu({
  id: 'db',
  title: 'Banco de dados local',
  description: 'Subir, parar, logs, status, migrations, seed, reset e Prisma Studio',
  group: 'Ambiente local',
  icon: '🐘',
  keywords: ['postgres', 'docker', 'prisma', 'banco', 'database'],
  children: [dbStatus, dbStart, dbStop, dbLogs, dbGenerate, dbMigrate, dbSeed, dbReset, dbStudio],
});
