import fs from 'node:fs';
import path from 'node:path';
import type { CommandContext } from '../../core/command.js';
import { httpProbe, isPortOpen, waitForPort } from '../../core/net.js';
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

/** Usuário e senha do broker. Servem só para autenticar na API do painel e nunca são exibidos. */
export interface BrokerCredentials {
  username: string;
  password: string;
}

/** Credencial de desenvolvimento do `apps/backend/docker-compose.yml`. */
export const DEFAULT_BROKER_CREDENTIALS: BrokerCredentials = { username: 'jaja', password: 'jaja' };

function decodeUrlPart(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/**
 * Lê usuário e senha da `RABBITMQ_URL` do .env do backend (ex.: `amqp://jaja:jaja@localhost:5672`), decodificando
 * caracteres codificados (`%40` → `@`). Chave ausente, URL inválida ou sem usuário voltam ao padrão `jaja`/`jaja`.
 * O resultado só vai no cabeçalho `Authorization`: nunca na URL nem em mensagens.
 */
export function readBrokerCredentials(env: Record<string, string>): BrokerCredentials {
  const raw = env.RABBITMQ_URL?.trim();
  if (!raw) return { ...DEFAULT_BROKER_CREDENTIALS };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ...DEFAULT_BROKER_CREDENTIALS };
  }
  if (!url.username) return { ...DEFAULT_BROKER_CREDENTIALS };
  const username = decodeUrlPart(url.username);
  const password = decodeUrlPart(url.password);
  if (username === null || password === null) return { ...DEFAULT_BROKER_CREDENTIALS };
  return { username, password };
}

/** Cabeçalho de autenticação básica para a API do painel. */
export function basicAuthHeader(credentials: BrokerCredentials): string {
  return `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`, 'utf8').toString('base64')}`;
}

/** URL da listagem de filas do vhost `/` na API do painel, só com host e porta. */
export function managementQueuesUrl(ports: BrokerPorts): string {
  return `${brokerUrls(ports).management}/api/queues/%2F`;
}

/** URL das mensagens de uma fila do vhost `/` (`DELETE` esvazia a fila), com o nome codificado e sem credenciais. */
export function managementQueueContentsUrl(ports: BrokerPorts, queue: string): string {
  return `${managementQueuesUrl(ports)}/${encodeURIComponent(queue)}/contents`;
}

/** Campos usados de cada fila devolvida por `GET /api/queues/%2F`. A API omite os contadores enquanto não há estatística. */
export interface ManagementQueue {
  name: string;
  messages_ready?: number;
  messages_unacknowledged?: number;
  consumers?: number;
}

/** Linha da tabela por consumidor: soma das filas `jaja.<consumidor>`, `.wait` e `.dead`. */
export interface ConsumerQueueRow {
  /** Nome do consumidor, sem o prefixo `jaja.` (ex.: `orders.approve-payment`). */
  consumer: string;
  /** Prontas para entrega na fila do consumidor. */
  ready: number;
  /** Entregues e ainda sem confirmação (em processamento). */
  unacked: number;
  /** Na fila `.wait` (nova tentativa ou espera inicial). */
  waiting: number;
  /** Na fila `.dead` (descartadas). */
  dead: number;
  /** Consumidores conectados à fila do consumidor. */
  consumers: number;
}

/** Fila de inspeção (`jaja.events.all`), mostrada à parte. */
export interface InspectionQueueRow {
  name: string;
  ready: number;
  unacked: number;
  consumers: number;
}

export interface QueuesSummary {
  /** Linhas por consumidor, em ordem alfabética. */
  rows: ConsumerQueueRow[];
  /** `null` quando a fila de inspeção não existe. */
  inspection: InspectionQueueRow | null;
  /** Filas `.dead` com mensagens, na ordem das linhas. */
  deadLetters: { queue: string; messages: number }[];
}

/** Prefixo das filas do projeto. */
export const QUEUE_PREFIX = 'jaja.';

/** Fila de inspeção padrão (`RABBITMQ_INSPECTION_QUEUE`). */
export const DEFAULT_INSPECTION_QUEUE = 'jaja.events.all';

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Agrupa as filas da API do painel por consumidor: `jaja.<consumidor>` (prontas, em processamento e consumidores
 * conectados), `jaja.<consumidor>.wait` (na espera) e `jaja.<consumidor>.dead` (descartadas). Uma `.wait` ou `.dead`
 * sem a fila principal ainda gera a linha. A fila de inspeção fica à parte e filas fora do prefixo `jaja.` são ignoradas.
 * Função pura: não acessa rede nem arquivos.
 */
export function summarizeQueues(queues: ManagementQueue[], inspectionQueue: string = DEFAULT_INSPECTION_QUEUE): QueuesSummary {
  const rows = new Map<string, ConsumerQueueRow>();
  let inspection: InspectionQueueRow | null = null;
  const rowOf = (consumer: string) => {
    let row = rows.get(consumer);
    if (!row) {
      row = { consumer, ready: 0, unacked: 0, waiting: 0, dead: 0, consumers: 0 };
      rows.set(consumer, row);
    }
    return row;
  };

  for (const queue of queues) {
    if (typeof queue?.name !== 'string') continue;
    const ready = count(queue.messages_ready);
    const unacked = count(queue.messages_unacknowledged);
    const consumers = count(queue.consumers);
    if (queue.name === inspectionQueue) {
      inspection = { name: queue.name, ready, unacked, consumers };
      continue;
    }
    if (!queue.name.startsWith(QUEUE_PREFIX)) continue;
    const base = queue.name.slice(QUEUE_PREFIX.length);
    const suffix = base.endsWith('.wait') ? '.wait' : base.endsWith('.dead') ? '.dead' : '';
    const consumer = base.slice(0, base.length - suffix.length);
    if (!consumer) continue;
    const row = rowOf(consumer);
    if (suffix === '.wait') row.waiting += ready + unacked;
    else if (suffix === '.dead') row.dead += ready + unacked;
    else {
      row.ready += ready;
      row.unacked += unacked;
      row.consumers += consumers;
    }
  }

  const sorted = [...rows.values()].sort((a, b) => a.consumer.localeCompare(b.consumer));
  const deadLetters = sorted.filter((row) => row.dead > 0).map((row) => ({ queue: `${QUEUE_PREFIX}${row.consumer}.dead`, messages: row.dead }));
  return { rows: sorted, inspection, deadLetters };
}

/** Resultado de `listManagementQueues`: as filas, ou o motivo (sem credenciais) de não conseguir lê-las. */
export type ManagementQueuesListing = { ok: true; queues: ManagementQueue[] } | { ok: false; reason: string };

/**
 * Lê `GET /api/queues/%2F` do painel com a credencial só no cabeçalho. Nunca lança: painel sem resposta, credencial
 * recusada, HTTP de erro ou resposta que não é lista viram `{ ok: false, reason }`, com host e porta mas sem credenciais.
 */
export async function listManagementQueues(ctx: CommandContext, ports: BrokerPorts, credentials: BrokerCredentials): Promise<ManagementQueuesListing> {
  const { management } = brokerUrls(ports);
  const probe = await httpProbe(managementQueuesUrl(ports), {
    timeoutMs: 5000,
    signal: ctx.signal,
    headers: { authorization: basicAuthHeader(credentials), accept: 'application/json' },
  });
  if (probe.status === null) return { ok: false, reason: `o painel do RabbitMQ não respondeu em ${management}${probe.error ? ` (${probe.error})` : ''}` };
  if (probe.status === 401 || probe.status === 403) return { ok: false, reason: `o painel do RabbitMQ recusou a credencial de RABBITMQ_URL (HTTP ${probe.status})` };
  if (!probe.ok) return { ok: false, reason: `o painel do RabbitMQ respondeu HTTP ${probe.status} em ${management}` };
  try {
    const parsed: unknown = JSON.parse(probe.body);
    if (!Array.isArray(parsed)) throw new Error('resposta não é uma lista');
    return { ok: true, queues: (parsed as ManagementQueue[]).filter((queue) => typeof queue?.name === 'string') };
  } catch {
    return { ok: false, reason: `resposta inesperada da API do painel em ${management}` };
  }
}
