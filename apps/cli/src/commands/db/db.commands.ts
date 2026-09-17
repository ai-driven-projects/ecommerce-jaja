import type { Command, CommandContext } from '../../core/command.js';
import { httpProbe } from '../../core/net.js';
import { menu } from '../../core/wizard.js';
import {
  basicAuthHeader,
  brokerUrls,
  listManagementQueues,
  type ManagementQueue,
  managementQueueContentsUrl,
  readBackendEnv,
  readBrokerCredentials,
  readBrokerPorts,
} from '../broker/lib.js';
import {
  type ClearOrdersCounts,
  clearOrdersSql,
  compose,
  describeTarget,
  ensureDatabaseUp,
  inspectDatabase,
  migrateDevArgs,
  parseClearOrdersOutput,
  prisma,
  prismaCommand,
  queuesToPurge,
  readDatabaseTarget,
  requireBackend,
} from './lib.js';

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

export const CLEAR_ORDERS_CONFIRM = 'Isso apaga TODOS os pedidos, os eventos deles e as mensagens nas filas. Continuar?';

function queueMessages(queue: ManagementQueue): number {
  const ready = typeof queue.messages_ready === 'number' ? queue.messages_ready : 0;
  const unacked = typeof queue.messages_unacknowledged === 'number' ? queue.messages_unacknowledged : 0;
  return ready + unacked;
}

function describeCounts(counts: ClearOrdersCounts | null): string {
  return counts ? `${counts.orders} pedido(s), ${counts.events} evento(s) e ${counts.marks} marca(s) apagados` : 'pedidos apagados (contagens não lidas)';
}

/**
 * Esvazia, pela API do painel, as filas de `queuesToPurge`. A credencial vai só no cabeçalho `Authorization`.
 * Devolve quantas foram esvaziadas e quantas falharam, ou `null` quando o painel não pôde ser lido (broker fora do ar).
 */
async function purgeOrderQueues(ctx: CommandContext): Promise<{ purged: number; failed: number } | null> {
  const env = readBackendEnv(ctx);
  const ports = readBrokerPorts(env);
  const credentials = readBrokerCredentials(env);
  const listing = await listManagementQueues(ctx, ports, credentials);
  if (!listing.ok) {
    ctx.report.warn(`Filas não esvaziadas: ${listing.reason}.`);
    ctx.report.detail('Os dados do banco já foram apagados. Suba o broker com `jaja broker:start` e rode `jaja db:clear-orders` de novo para esvaziar as filas.');
    return null;
  }
  const byName = new Map(listing.queues.map((queue) => [queue.name, queue]));
  const names = queuesToPurge(listing.queues.map((queue) => queue.name));
  let purged = 0;
  let failed = 0;
  for (const name of names) {
    if (ctx.signal.aborted) break;
    const before = byName.get(name);
    const response = await httpProbe(managementQueueContentsUrl(ports, name), {
      method: 'DELETE',
      timeoutMs: 5000,
      signal: ctx.signal,
      headers: { authorization: basicAuthHeader(credentials) },
    });
    if (response.ok) {
      purged += 1;
      ctx.report.detail(`${name}: esvaziada (${before ? queueMessages(before) : 0} mensagem(ns) antes)`);
    } else {
      failed += 1;
      ctx.report.warn(`Não foi possível esvaziar ${name} (${response.status === null ? (response.error ?? 'sem resposta') : `HTTP ${response.status}`}).`);
    }
  }
  return { purged, failed };
}

export const dbClearOrders: Command = {
  id: 'db:clear-orders',
  title: 'Limpar pedidos',
  description: 'Apaga todos os pedidos, os eventos de pedido do outbox e suas marcas, e esvazia as filas jaja.* (para demonstrações)',
  group: 'Banco',
  keywords: ['pedidos', 'orders', 'limpar', 'demo'],
  async run(ctx) {
    requireBackend(ctx);
    const target = readDatabaseTarget(ctx);
    const where = describeTarget(target);
    if (!target.isLocal) {
      ctx.report.error(`A DATABASE_URL aponta para ${where}, mas db:clear-orders só limpa o PostgreSQL local do Docker Compose (psql no container).`);
      return { status: 'error', summary: 'Banco não é o PostgreSQL local; nada apagado' };
    }
    if (!target.user || !target.database) {
      ctx.report.error('A DATABASE_URL precisa ter usuário e nome do banco para o psql.');
      return { status: 'error', summary: 'DATABASE_URL sem usuário ou banco; nada apagado' };
    }
    const psqlArgs = ['exec', '-T', 'postgres', 'psql', '-U', target.user, '-d', target.database, '-At', '-v', 'ON_ERROR_STOP=1'];
    const shownCommand = `docker compose ${psqlArgs.join(' ')} < SQL`;
    const sql = clearOrdersSql();

    if (ctx.dryRun) {
      ctx.report.info(`[dry-run] pediria confirmação: ${CLEAR_ORDERS_CONFIRM}`);
      ctx.report.info(`[dry-run] $ ${shownCommand}`);
      for (const line of sql.trimEnd().split('\n')) ctx.report.detail(line);
      const env = readBackendEnv(ctx);
      const ports = readBrokerPorts(env);
      const listing = await listManagementQueues(ctx, ports, readBrokerCredentials(env));
      if (!listing.ok) {
        ctx.report.info(`[dry-run] filas não listadas: ${listing.reason}. Com o broker no ar, as filas jaja.* (exceto jaja.live.*) seriam esvaziadas.`);
        return { status: 'ok', summary: 'Dry-run: nada apagado' };
      }
      const names = queuesToPurge(listing.queues.map((queue) => queue.name));
      ctx.report.info(`[dry-run] esvaziaria ${names.length} fila(s) com DELETE ${brokerUrls(ports).management}/api/queues/%2F/<fila>/contents:`);
      for (const queue of listing.queues.filter((item) => names.includes(item.name))) ctx.report.detail(`${queue.name} (${queueMessages(queue)} mensagem(ns))`);
      return { status: 'ok', summary: `Dry-run: nada apagado (${names.length} fila(s) seriam esvaziadas)` };
    }

    // Sem --yes a resposta padrão é "não"; com --yes a confirmação é assumida.
    if (!(await ctx.confirm(CLEAR_ORDERS_CONFIRM, ctx.yes))) return { status: 'warn', summary: 'Cancelado pelo usuário' };

    ctx.report.info(`$ ${shownCommand}`);
    const result = await compose(ctx, psqlArgs, true, sql);
    if (ctx.signal.aborted) return { status: 'warn', summary: 'Interrompido' };
    if (!result.ok) {
      ctx.report.error(`A limpeza no PostgreSQL local (${where}) falhou; nada foi apagado.`);
      const stderr = result.stderr.trim();
      if (stderr) ctx.report.detail(stderr);
      ctx.report.detail('Confira se o serviço postgres do Docker Compose está no ar (`jaja db:start`).');
      return { status: 'error', summary: 'Falha ao apagar os pedidos no PostgreSQL' };
    }
    const counts = parseClearOrdersOutput(result.stdout);
    if (counts) ctx.report.success(`${describeCounts(counts)}.`);
    else {
      ctx.report.warn('A instrução terminou sem erro, mas a saída do psql não trouxe as contagens esperadas.');
      if (result.stdout.trim()) ctx.report.detail(result.stdout.trim());
    }

    const queues = await purgeOrderQueues(ctx);
    if (ctx.signal.aborted) return { status: 'warn', summary: `${describeCounts(counts)} · interrompido ao esvaziar as filas` };
    if (!queues) return { status: 'warn', summary: `${describeCounts(counts)} · filas não esvaziadas (RabbitMQ fora do ar)` };
    const summary = `${describeCounts(counts)} · ${queues.purged} fila(s) esvaziada(s)${queues.failed ? `, ${queues.failed} com falha` : ''}`;
    return { status: counts && queues.failed === 0 ? 'ok' : 'warn', summary };
  },
};

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
  description: 'Subir, parar, logs, status, migrations, seed, reset, limpar pedidos e Prisma Studio',
  group: 'Ambiente local',
  icon: '🐘',
  keywords: ['postgres', 'docker', 'prisma', 'banco', 'database'],
  children: [dbStatus, dbStart, dbStop, dbLogs, dbGenerate, dbMigrate, dbSeed, dbReset, dbClearOrders, dbStudio],
});
