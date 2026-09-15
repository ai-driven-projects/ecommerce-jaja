import fs from 'node:fs';
import path from 'node:path';
import type { CommandContext } from '../../core/command.js';
import { isPortOpen, waitForPort } from '../../core/net.js';
import { isFile } from '../../core/project.js';
import { compose, detectCompose, requireBackend } from '../db/lib.js';
import { parseEnv } from '../doctor/env.js';

/** Portas publicadas no host pelo serviço `rabbitmq` do `apps/backend/docker-compose.yml`. */
export interface BrokerPorts {
  amqp: number;
  management: number;
}

export const DEFAULT_BROKER_PORTS: BrokerPorts = { amqp: 5672, management: 15672 };

/** Nome do serviço no docker-compose.yml do backend. */
export const BROKER_SERVICE = 'rabbitmq';

function toPort(value: string | undefined, fallback: number): number {
  if (value === undefined || !/^\d+$/.test(value.trim())) return fallback;
  const port = Number(value.trim());
  return port >= 1 && port <= 65535 ? port : fallback;
}

/** Lê `RABBITMQ_PORT` e `RABBITMQ_MANAGEMENT_PORT` do .env do backend; ausentes ou inválidas voltam ao padrão. */
export function readBrokerPorts(env: Record<string, string>): BrokerPorts {
  return {
    amqp: toPort(env.RABBITMQ_PORT, DEFAULT_BROKER_PORTS.amqp),
    management: toPort(env.RABBITMQ_MANAGEMENT_PORT, DEFAULT_BROKER_PORTS.management),
  };
}

/**
 * Endereços para exibir no terminal. Nunca usa a `RABBITMQ_URL`, que carrega usuário e senha:
 * as URLs são montadas só com host e porta.
 */
export function brokerUrls(ports: BrokerPorts): { amqp: string; management: string } {
  return { amqp: `amqp://localhost:${ports.amqp}`, management: `http://localhost:${ports.management}` };
}

export interface ComposeServiceState {
  /** Estado do container no Docker (`running`, `exited`, `restarting`...). */
  state: string;
  /** Resultado do healthcheck (`healthy`, `starting`, `unhealthy`) ou `null` quando não há. */
  health: string | null;
  /** Texto do Docker, ex.: `Up 2 minutes (healthy)`. */
  status: string;
  running: boolean;
  healthy: boolean;
}

interface ComposePsEntry {
  State?: unknown;
  Health?: unknown;
  Status?: unknown;
}

function parseEntries(stdout: string): ComposePsEntry[] {
  const text = stdout.trim();
  if (!text) return [];
  // Compose v2 antigo devolve um array JSON; as versões atuais, um objeto JSON por linha.
  if (text.startsWith('[')) {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as ComposePsEntry[]) : [];
  }
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ComposePsEntry);
}

/** Interpreta `docker compose ps -a --format json rabbitmq`. Saída vazia (serviço nunca criado) → `null`. */
export function parseComposeServiceState(stdout: string): ComposeServiceState | null {
  let entries: ComposePsEntry[];
  try {
    entries = parseEntries(stdout);
  } catch {
    return null;
  }
  const entry = entries[0];
  if (!entry) return null;
  const state = typeof entry.State === 'string' && entry.State ? entry.State.toLowerCase() : 'unknown';
  const health = typeof entry.Health === 'string' && entry.Health ? entry.Health.toLowerCase() : null;
  const status = typeof entry.Status === 'string' ? entry.Status : '';
  const running = state === 'running';
  return { state, health, status, running, healthy: running && health === 'healthy' };
}

/** Variáveis do `apps/backend/.env` (vazio quando o arquivo não existe: valem os padrões). */
export function readBackendEnv(ctx: CommandContext): Record<string, string> {
  const envPath = path.join(requireBackend(ctx), '.env');
  return isFile(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
}

/** Estado do serviço `rabbitmq` no Docker Compose; `null` quando o container ainda não foi criado. */
export async function inspectBrokerService(ctx: CommandContext): Promise<{ ok: boolean; state: ComposeServiceState | null; error?: string }> {
  const result = await compose(ctx, ['ps', '-a', '--format', 'json', BROKER_SERVICE], true);
  if (!result.ok) return { ok: false, state: null, error: result.stderr.trim() || `código ${result.code}` };
  return { ok: true, state: parseComposeServiceState(result.stdout) };
}

/**
 * Sobe o serviço `rabbitmq`. Com o plugin `docker compose`, `up -d --wait` só termina com o healthcheck saudável;
 * com o `docker-compose` legado (sem `--wait`), ou se o `--wait` falhar, cai em `up -d` + espera da porta AMQP.
 */
export async function startBroker(ctx: CommandContext, ports: BrokerPorts): Promise<boolean> {
  const engine = await detectCompose(ctx);
  if (!engine) throw new Error('Docker Compose não encontrado. Instale o Docker Desktop.');
  const where = `localhost:${ports.amqp}`;

  if (engine.command === 'docker') {
    const up = await compose(ctx, ['up', '-d', '--wait', BROKER_SERVICE]);
    if (ctx.signal.aborted) return false;
    if (up.ok) {
      if (await waitForPort('localhost', ports.amqp, { attempts: 5, delayMs: 1000, signal: ctx.signal })) {
        ctx.report.success(`RabbitMQ saudável em ${where}.`);
        return true;
      }
      ctx.report.warn(`O healthcheck passou, mas a porta ${ports.amqp} continua fechada.`);
      ctx.report.detail('Confira se RABBITMQ_PORT no apps/backend/.env é a mesma porta publicada no docker-compose.yml.');
      return false;
    }
    ctx.report.warn('`docker compose up -d --wait rabbitmq` falhou; tentando `up -d` e aguardando a porta AMQP.');
  }

  const up = await compose(ctx, ['up', '-d', BROKER_SERVICE]);
  if (ctx.signal.aborted) return false;
  if (!up.ok) {
    ctx.report.error('Falha ao subir o serviço "rabbitmq" com Docker Compose.');
    return false;
  }
  if (await waitForPort('localhost', ports.amqp, { attempts: 40, delayMs: 1500, signal: ctx.signal })) {
    ctx.report.success(`RabbitMQ respondendo em ${where}.`);
    return true;
  }
  ctx.report.warn(`Docker Compose rodou, mas a porta ${ports.amqp} continua fechada.`);
  ctx.report.detail('Confira se RABBITMQ_PORT no apps/backend/.env é a mesma porta publicada no docker-compose.yml.');
  return false;
}

/**
 * Garante o RabbitMQ local de pé, no molde de `ensureDatabaseUp`: porta AMQP aberta → já está no ar, sem chamar o compose;
 * fechada → sobe o serviço `rabbitmq` e espera o healthcheck. Em dry-run só registra o comando. Devolve se ficou no ar.
 */
export async function ensureBrokerUp(ctx: CommandContext): Promise<boolean> {
  const ports = readBrokerPorts(readBackendEnv(ctx));
  const where = `localhost:${ports.amqp}`;
  if (await isPortOpen('localhost', ports.amqp)) {
    ctx.report.success(`RabbitMQ acessível em ${where}.`);
    return true;
  }
  if (ctx.dryRun) {
    ctx.report.info(`[dry-run] RabbitMQ local fora do ar em ${where}; $ docker compose up -d --wait rabbitmq`);
    return false;
  }
  ctx.report.info(`RabbitMQ local fora do ar. Subindo o serviço rabbitmq com Docker Compose em ${where}...`);
  return startBroker(ctx, ports);
}
