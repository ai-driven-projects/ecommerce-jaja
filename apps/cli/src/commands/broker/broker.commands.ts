import type { Command } from '../../core/command.js';
import { isPortOpen } from '../../core/net.js';
import { menu } from '../../core/wizard.js';
import { compose } from '../db/lib.js';
import { brokerUrls, ensureBrokerUp, inspectBrokerService, readBackendEnv, readBrokerPorts } from './lib.js';

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

export const brokerMenu: Command = menu({
  id: 'broker',
  title: 'Mensageria local',
  description: 'Status, subir, parar e logs do RabbitMQ local',
  group: 'Ambiente local',
  icon: '🐇',
  keywords: ['rabbitmq', 'amqp', 'docker', 'broker', 'mensageria', 'eventos', 'fila'],
  children: [brokerStatus, brokerStart, brokerStop, brokerLogs],
});
