import fs from 'node:fs';
import path from 'node:path';
import type { Command, CommandContext, CommandResult } from '../../core/command.js';
import type { ExecResult } from '../../core/exec.js';
import { findOnPath } from '../../core/exec.js';
import { isPortOpen, sleep, waitForPort } from '../../core/net.js';
import { isDirectory, isFile } from '../../core/project.js';
import { parseDatabaseUrl, parseEnv, type DatabaseTarget } from '../doctor/env.js';

export function requireBackend(ctx: CommandContext): string {
  if (!ctx.project.backendDir) throw new Error('App backend não encontrado em apps/.');
  return ctx.project.backendDir;
}

export function readDatabaseUrl(ctx: CommandContext): string | null {
  const envPath = path.join(requireBackend(ctx), '.env');
  if (!isFile(envPath)) return null;
  return parseEnv(fs.readFileSync(envPath, 'utf8')).DATABASE_URL ?? null;
}

export function readDatabaseTarget(ctx: CommandContext): DatabaseTarget {
  const url = readDatabaseUrl(ctx);
  if (!url) throw new Error('DATABASE_URL não definida em apps/backend/.env. Rode a etapa "Arquivos .env" do setup antes.');
  const target = parseDatabaseUrl(url);
  if (!target) throw new Error(`DATABASE_URL inválida: ${url}`);
  return target;
}

export interface ComposeCommand {
  command: string;
  baseArgs: string[];
}

export async function detectCompose(ctx: CommandContext): Promise<ComposeCommand | null> {
  if (findOnPath('docker')) {
    const probe = await ctx.exec('docker', ['compose', 'version'], { quiet: true, timeoutMs: 10000 });
    if (probe.ok) return { command: 'docker', baseArgs: ['compose'] };
  }
  if (findOnPath('docker-compose')) return { command: 'docker-compose', baseArgs: [] };
  return null;
}

/** Executa `docker compose ... <args>` na pasta do backend, onde está o docker-compose.yml (e o .env com DB_PORT). */
export async function compose(ctx: CommandContext, args: string[], quiet = false): Promise<ExecResult> {
  const backendDir = requireBackend(ctx);
  if (!isFile(path.join(backendDir, 'docker-compose.yml'))) throw new Error('apps/backend/docker-compose.yml não encontrado.');
  const engine = await detectCompose(ctx);
  if (!engine) throw new Error('Docker Compose não encontrado. Instale o Docker Desktop.');
  return ctx.exec(engine.command, [...engine.baseArgs, '-f', 'docker-compose.yml', ...args], { cwd: backendDir, quiet });
}

/** Executa `npx prisma <args>` na pasta do backend. */
export function prisma(ctx: CommandContext, args: string[], quiet = false): Promise<ExecResult> {
  return ctx.exec('npx', ['prisma', ...args], { cwd: requireBackend(ctx), quiet });
}

export function isPrismaCliInstalled(ctx: CommandContext): boolean {
  return [ctx.project.rootDir, ctx.project.backendDir].some((dir) => dir && isFile(path.join(dir, 'node_modules', 'prisma', 'package.json')));
}

/** Há alguma migration em prisma/migrations? */
export function hasMigrations(backendDir: string): boolean {
  const dir = path.join(backendDir, 'prisma', 'migrations');
  if (!isDirectory(dir)) return false;
  return fs.readdirSync(dir, { withFileTypes: true }).some((entry) => entry.isDirectory());
}

/** `migrate dev` precisa de um nome quando vai criar a primeira migration (Prisma 7 não roda o seed sozinho). */
export function migrateDevArgs(ctx: CommandContext): string[] {
  const args = ['migrate', 'dev'];
  if (!hasMigrations(requireBackend(ctx))) args.push('--name', 'init');
  return args;
}

export interface DatabaseStatus {
  target: DatabaseTarget;
  portOpen: boolean;
  /** `null` quando o Prisma CLI ainda não está instalado para validar. */
  credentialsValid: boolean | null;
}

/** Verifica porta aberta e, se possível, credenciais via `prisma db execute`. */
export async function inspectDatabase(ctx: CommandContext): Promise<DatabaseStatus> {
  const target = readDatabaseTarget(ctx);
  const portOpen = await isPortOpen(target.host, target.port);
  if (!portOpen) return { target, portOpen, credentialsValid: false };
  if (!isPrismaCliInstalled(ctx)) return { target, portOpen, credentialsValid: null };
  const probe = await ctx.exec('npx', ['prisma', 'db', 'execute', '--stdin'], { cwd: requireBackend(ctx), input: 'SELECT 1;', quiet: true, timeoutMs: 45000 });
  return { target, portOpen, credentialsValid: probe.ok };
}

export function describeTarget(target: DatabaseTarget): string {
  return `${target.host}:${target.port}`;
}

/**
 * Garante que o banco está de pé. Se for local e a porta estiver fechada, sobe com Docker Compose.
 * Devolve `true` quando as credenciais foram validadas.
 */
export async function ensureDatabaseUp(ctx: CommandContext): Promise<boolean> {
  const status = await inspectDatabase(ctx);
  const where = describeTarget(status.target);

  if (status.credentialsValid === true) {
    ctx.report.success(`Banco acessível em ${where} e credenciais válidas.`);
    return true;
  }
  if (status.portOpen) {
    if (status.credentialsValid === null) {
      ctx.report.warn(`Porta aberta em ${where}, mas o Prisma CLI ainda não está instalado para validar as credenciais.`);
      return false;
    }
    ctx.report.warn(`Porta ${status.target.port} aberta em ${status.target.host}, mas as credenciais da DATABASE_URL falharam.`);
    ctx.report.detail('Outro PostgreSQL pode estar usando a porta (ex.: o container de outro projeto). Ajuste DB_PORT/DATABASE_URL no apps/backend/.env ou pare a instância.');
    return false;
  }
  if (!status.target.isLocal) {
    ctx.report.warn(`DATABASE_URL aponta para ${where}, que não responde. Verifique a rede e as credenciais.`);
    return false;
  }

  if (ctx.dryRun) {
    ctx.report.info(`[dry-run] banco local fora do ar em ${where}; $ docker compose up -d postgres`);
    return false;
  }
  ctx.report.info(`Banco local fora do ar. Subindo o PostgreSQL com Docker Compose em ${where}...`);
  const up = await compose(ctx, ['up', '-d', 'postgres']);
  if (!up.ok) throw new Error('Falha ao subir o serviço "postgres" com Docker Compose.');

  const ready = await waitForPort(status.target.host, status.target.port, { signal: ctx.signal });
  if (!ready) {
    ctx.report.warn(`Docker Compose rodou, mas a porta ${status.target.port} continua fechada.`);
    ctx.report.detail('Confira se DB_PORT no apps/backend/.env é a mesma porta publicada no docker-compose.yml.');
    return false;
  }
  // Na primeira subida o Postgres abre a porta durante a inicialização e reinicia; insiste um pouco.
  let after = await inspectDatabase(ctx);
  for (let attempt = 0; attempt < 10 && after.credentialsValid === false && !ctx.signal.aborted; attempt += 1) {
    await sleep(2000);
    after = await inspectDatabase(ctx);
  }
  if (after.credentialsValid === true) {
    ctx.report.success(`Banco iniciado em ${where}.`);
    return true;
  }
  if (after.credentialsValid === null) {
    ctx.report.success(`Banco iniciado em ${where}. Credenciais serão validadas após o npm install.`);
    return false;
  }
  ctx.report.warn(`Banco iniciado em ${where}, mas as credenciais da DATABASE_URL falharam.`);
  return false;
}

/** Comando simples que executa um único `npx prisma <args>`. */
export function prismaCommand(spec: { id: string; title: string; description: string; keywords?: string[]; args: string[] | ((ctx: CommandContext) => string[]); needsDatabase?: boolean; confirm?: string }): Command {
  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    group: 'Banco',
    keywords: ['prisma', ...(spec.keywords ?? [])],
    async run(ctx): Promise<CommandResult> {
      requireBackend(ctx);
      const args = typeof spec.args === 'function' ? spec.args(ctx) : spec.args;
      if (spec.confirm && !(await ctx.confirm(spec.confirm, false))) return { status: 'warn', summary: 'Cancelado pelo usuário' };
      if (ctx.dryRun) {
        ctx.report.info(`[dry-run] $ npx prisma ${args.join(' ')}`);
        return { status: 'ok', summary: 'Dry-run: nada executado' };
      }
      if (spec.needsDatabase && !(await ensureDatabaseUp(ctx))) return { status: 'error', summary: 'Banco de dados indisponível' };
      ctx.report.info(`npx prisma ${args.join(' ')}`);
      const result = await prisma(ctx, args);
      if (ctx.signal.aborted) return { status: 'warn', summary: 'Interrompido' };
      return result.ok ? { status: 'ok', summary: `prisma ${args[0]} concluído` } : { status: 'error', summary: `prisma ${args.join(' ')} falhou (código ${result.code})` };
    },
  };
}
