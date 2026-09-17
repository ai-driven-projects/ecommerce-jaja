import type { Command } from '../../core/command.js';
import { httpProbe, isPortOpen } from '../../core/net.js';
import { menu } from '../../core/wizard.js';
import { compose } from '../db/lib.js';
import {
  basicAuthHeader,
  brokerUrls,
  type ConsumerQueueRow,
  DEFAULT_INSPECTION_QUEUE,
  ensureBrokerUp,
  inspectBrokerService,
  type ManagementQueue,
  managementQueuesUrl,
  readBackendEnv,
  readBrokerCredentials,
  readBrokerPorts,
  summarizeQueues,
} from './lib.js';

export const brokerStatus: Command = {
  id: 'broker:status',
  title: 'Status do RabbitMQ',
  description: 'Mostra o estado do serviço rabbitmq no Docker Compose e as URLs do AMQP e do painel',
  group: 'Mensageria',
  keywords: ['rabbitmq', 'amqp', 'painel', 'ping'],
  async run(ctx) {
    const ports = readBrokerPorts(readBackendEnv(ctx));
    const urls = brokerUrls(ports);
    ctx.report.info(`AMQP  → ${urls.amqp}`);
    ctx.report.info(`Painel → ${urls.management}`);

    let service: Awaited<ReturnType<typeof inspectBrokerService>>;
    try {
      service = await inspectBrokerService(ctx);
    } catch (error) {
      ctx.report.warn(error instanceof Error ? error.message : String(error));
      return { status: 'warn', summary: 'Não foi possível consultar o Docker Compose' };
    }
    if (!service.ok) {
      ctx.report.warn('docker compose ps falhou (o Docker está no ar?).');
      if (service.error) ctx.report.detail(service.error);
      return { status: 'warn', summary: 'Não foi possível consultar o serviço rabbitmq' };
    }

    const { state } = service;
    if (!state) {
      ctx.report.warn('Serviço rabbitmq ainda não foi criado.');
      ctx.report.detail('Suba com `jaja broker:start` (ou o setup).');
      return { status: 'warn', summary: `RabbitMQ não está rodando (${urls.amqp})` };
    }
    ctx.report.info(`Serviço rabbitmq: ${state.state}${state.health ? ` (${state.health})` : ''}${state.status ? ` — ${state.status}` : ''}`);
    if (!state.running) {
      ctx.report.warn('Serviço rabbitmq não está rodando.');
      ctx.report.detail('O backend sobe sem o broker; os eventos ficam pendentes até ele voltar. Suba com `jaja broker:start`.');
      return { status: 'warn', summary: `RabbitMQ parado (${urls.amqp})` };
    }

    const portOpen = await isPortOpen('localhost', ports.amqp);
    if (portOpen) ctx.report.success(`Porta AMQP ${ports.amqp} aberta.`);
    else ctx.report.warn(`Porta AMQP ${ports.amqp} fechada.`);
    if (state.health === 'starting') return { status: 'warn', summary: 'RabbitMQ iniciando (healthcheck pendente)' };
    if (state.health === 'unhealthy') return { status: 'warn', summary: 'RabbitMQ rodando, mas o healthcheck falhou' };
    if (!portOpen) return { status: 'warn', summary: `RabbitMQ rodando, mas ${urls.amqp} não responde` };
    return { status: 'ok', summary: `RabbitMQ ok em ${urls.amqp}` };
  },
};

export const brokerStart: Command = {
  id: 'broker:start',
  title: 'Subir RabbitMQ local',
  description: 'Sobe o serviço rabbitmq com Docker Compose e espera o healthcheck',
  group: 'Mensageria',
  keywords: ['rabbitmq', 'docker', 'up', 'iniciar'],
  async run(ctx) {
    const ready = await ensureBrokerUp(ctx);
    if (ctx.dryRun) return { status: 'ok', summary: 'Dry-run concluído' };
    if (ctx.signal.aborted) return { status: 'warn', summary: 'Interrompido' };
    return ready ? { status: 'ok', summary: 'RabbitMQ pronto' } : { status: 'error', summary: 'RabbitMQ não ficou pronto, veja os avisos' };
  },
};

export const brokerStop: Command = {
  id: 'broker:stop',
  title: 'Parar RabbitMQ local',
  description: 'Para só o container do RabbitMQ (mensagens duráveis ficam no volume)',
  group: 'Mensageria',
  keywords: ['rabbitmq', 'docker', 'stop', 'parar'],
  async run(ctx) {
    if (ctx.dryRun) {
      ctx.report.info('[dry-run] $ docker compose stop rabbitmq');
      return { status: 'ok', summary: 'Dry-run: nada executado' };
    }
    const result = await compose(ctx, ['stop', 'rabbitmq']);
    return result.ok ? { status: 'ok', summary: 'RabbitMQ parado' } : { status: 'error', summary: 'docker compose stop rabbitmq falhou' };
  },
};

export const brokerLogs: Command = {
  id: 'broker:logs',
  title: 'Logs do RabbitMQ',
  description: 'Acompanha os logs do RabbitMQ local (Esc encerra)',
  group: 'Mensageria',
  keywords: ['rabbitmq', 'docker', 'log'],
  async run(ctx) {
    const result = await compose(ctx, ['logs', '--tail', '100', '-f', 'rabbitmq']);
    if (ctx.signal.aborted) return { status: 'ok', summary: 'Logs encerrados' };
    return result.ok ? { status: 'ok', summary: 'Logs encerrados' } : { status: 'error', summary: 'Não foi possível ler os logs' };
  },
};

const QUEUE_COLUMNS: { label: string; value: (row: ConsumerQueueRow) => number }[] = [
  { label: 'prontas', value: (row) => row.ready },
  { label: 'em processamento', value: (row) => row.unacked },
  { label: 'na espera', value: (row) => row.waiting },
  { label: 'descartadas', value: (row) => row.dead },
  { label: 'consumidores', value: (row) => row.consumers },
];

/** Linhas alinhadas da tabela por consumidor (cabeçalho + uma linha por consumidor). */
function queuesTable(rows: ConsumerQueueRow[]): string[] {
  const width = Math.max('consumidor'.length, ...rows.map((row) => row.consumer.length));
  const header = ['consumidor'.padEnd(width), ...QUEUE_COLUMNS.map((column) => column.label)].join('  ');
  const lines = rows.map((row) =>
    [row.consumer.padEnd(width), ...QUEUE_COLUMNS.map((column) => String(column.value(row)).padStart(column.label.length))].join('  '),
  );
  return [header, ...lines];
}

export const brokerQueues: Command = {
  id: 'broker:queues',
  title: 'Filas do RabbitMQ',
  description: 'Mostra, por consumidor, as mensagens prontas, em processamento, na espera e descartadas (API do painel)',
  group: 'Mensageria',
  keywords: ['filas', 'queues', 'dead', 'descarte'],
  async run(ctx) {
    const env = readBackendEnv(ctx);
    const ports = readBrokerPorts(env);
    const { management } = brokerUrls(ports);
    const inspectionQueue = env.RABBITMQ_INSPECTION_QUEUE?.trim() || DEFAULT_INSPECTION_QUEUE;
    // A credencial vai só no cabeçalho: a URL consultada (e qualquer erro do fetch) tem apenas host e porta.
    const probe = await httpProbe(managementQueuesUrl(ports), {
      timeoutMs: 5000,
      signal: ctx.signal,
      headers: { authorization: basicAuthHeader(readBrokerCredentials(env)), accept: 'application/json' },
    });
    if (ctx.signal.aborted) return { status: 'warn', summary: 'Interrompido' };

    if (probe.status === null) {
      ctx.report.warn(`O painel do RabbitMQ não respondeu em ${management}${probe.error ? ` (${probe.error})` : ''}.`);
      ctx.report.detail('Suba o broker com `jaja broker:start`.');
      return { status: 'warn', summary: `Painel do RabbitMQ sem resposta em ${management}` };
    }
    if (probe.status === 401 || probe.status === 403) {
      ctx.report.warn(`O painel do RabbitMQ recusou a credencial de RABBITMQ_URL (HTTP ${probe.status}).`);
      ctx.report.detail('Confira o usuário e a senha de RABBITMQ_URL no apps/backend/.env ou suba o broker local com `jaja broker:start`.');
      return { status: 'warn', summary: 'Painel do RabbitMQ recusou a credencial' };
    }
    if (!probe.ok) {
      ctx.report.warn(`O painel do RabbitMQ respondeu HTTP ${probe.status} em ${management}.`);
      ctx.report.detail('O broker pode estar iniciando. Suba ou aguarde com `jaja broker:start`.');
      return { status: 'warn', summary: `Painel do RabbitMQ respondeu HTTP ${probe.status}` };
    }

    let queues: ManagementQueue[];
    try {
      const parsed: unknown = JSON.parse(probe.body);
      if (!Array.isArray(parsed)) throw new Error('resposta não é uma lista');
      queues = parsed as ManagementQueue[];
    } catch {
      ctx.report.warn(`Resposta inesperada da API do painel em ${management}.`);
      ctx.report.detail('Confira se RABBITMQ_MANAGEMENT_PORT aponta para o painel do RabbitMQ ou suba o broker com `jaja broker:start`.');
      return { status: 'warn', summary: 'Resposta inesperada do painel do RabbitMQ' };
    }

    const summary = summarizeQueues(queues, inspectionQueue);
    ctx.report.title('Filas por consumidor');
    if (summary.rows.length === 0) {
      ctx.report.info('Nenhuma fila de consumidor (jaja.<consumidor>) encontrada.');
    } else {
      for (const line of queuesTable(summary.rows)) ctx.report.info(line);
      ctx.report.detail('na espera = fila .wait (nova tentativa ou espera inicial); descartadas = fila .dead');
    }

    ctx.report.title('Fila de inspeção');
    if (summary.inspection) {
      const { name, ready, unacked, consumers } = summary.inspection;
      ctx.report.info(`${name}: ${ready} pronta(s), ${unacked} em processamento, ${consumers} consumidor(es)`);
    } else {
      ctx.report.info(`${inspectionQueue} não encontrada (é criada quando o backend publica o primeiro evento).`);
    }

    if (summary.deadLetters.length > 0) {
      const messages = summary.deadLetters.map(({ queue, messages: total }) => `${total} mensagem(ns) descartada(s) em ${queue}`);
      for (const message of messages) ctx.report.warn(message);
      ctx.report.detail(`Inspecione pelo painel em ${management} (Queues → fila .dead → Get messages): cabeçalhos x-jaja-dead-reason e x-jaja-last-error.`);
      return { status: 'warn', summary: messages.join('; ') };
    }
    return { status: 'ok', summary: `Filas ok: ${summary.rows.length} consumidor(es), nenhuma mensagem descartada` };
  },
};

export const brokerMenu: Command = menu({
  id: 'broker',
  title: 'Mensageria local',
  description: 'Status, subir, parar, logs e filas do RabbitMQ local',
  group: 'Ambiente local',
  icon: '🐇',
  keywords: ['rabbitmq', 'amqp', 'docker', 'broker', 'mensageria', 'eventos', 'fila'],
  children: [brokerStatus, brokerStart, brokerStop, brokerLogs, brokerQueues],
});
