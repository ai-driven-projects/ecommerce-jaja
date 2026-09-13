import fs from 'node:fs';
import path from 'node:path';
import type { CommandContext } from '../../core/command.js';
import { extractVersion, findOnPath } from '../../core/exec.js';
import { isPortOpen } from '../../core/net.js';
import { isDirectory, isFile } from '../../core/project.js';
import { inspectDocker } from '../setup/docker.js';
import { diffEnv, meetsMinimumMajor, parseDatabaseUrl, parseEnv, parseSubmoduleStatus } from './env.js';

export type CheckStatus = 'ok' | 'warn' | 'error';

export interface CheckResult {
  status: CheckStatus;
  /** Texto curto exibido ao lado do rótulo. */
  detail: string;
  /** Como resolver, exibido só quando não está ok. */
  hint?: string;
}

export interface Check {
  id: string;
  label: string;
  run(ctx: CommandContext): Promise<CheckResult>;
}

export const MIN_NODE_MAJOR = 24;

async function versionOf(ctx: CommandContext, binary: string, args = ['--version']): Promise<string | null> {
  const result = await ctx.exec(binary, args, { quiet: true, timeoutMs: 15000 });
  if (result.notFound) return null;
  return extractVersion(result.stdout + result.stderr) ?? (result.ok ? 'instalado' : null);
}

interface ToolSpec {
  id: string;
  binary: string;
  label: string;
  purpose: string;
  install: string;
  /** Ferramentas opcionais geram aviso em vez de erro quando ausentes. */
  optional: boolean;
  args?: string[];
}

function toolCheck(spec: ToolSpec): Check {
  return {
    id: spec.id,
    label: spec.label,
    async run(ctx) {
      if (!findOnPath(spec.binary)) {
        return { status: spec.optional ? 'warn' : 'error', detail: 'não encontrado', hint: `${spec.purpose}. Instale com: ${spec.install}` };
      }
      const version = await versionOf(ctx, spec.binary, spec.args);
      return { status: 'ok', detail: version ?? 'instalado' };
    },
  };
}

const nodeCheck: Check = {
  id: 'node',
  label: 'Node.js',
  async run() {
    const version = process.versions.node;
    if (meetsMinimumMajor(version, MIN_NODE_MAJOR)) return { status: 'ok', detail: `v${version}` };
    return { status: 'error', detail: `v${version}`, hint: `O projeto exige Node ${MIN_NODE_MAJOR} ou superior. Use nvm/fnm para trocar a versão.` };
  },
};

const dockerCheck: Check = {
  id: 'docker',
  label: 'Docker',
  async run(ctx) {
    const docker = await inspectDocker(ctx);
    if (!docker.installed) return { status: 'warn', detail: 'não encontrado', hint: 'Necessário para o Postgres local (docker compose). Instale o Docker Desktop.' };
    if (!docker.running) return { status: 'warn', detail: 'daemon parado', hint: 'Abra o Docker Desktop antes de subir o banco local (o setup tenta abrir sozinho).' };
    return {
      status: docker.composeVersion ? 'ok' : 'warn',
      detail: `engine ${docker.version}${docker.composeVersion ? `, compose ${docker.composeVersion}` : ''}`,
      hint: docker.composeVersion ? undefined : 'O plugin `docker compose` não respondeu.',
    };
  },
};

const dependenciesCheck: Check = {
  id: 'dependencies',
  label: 'Dependências instaladas',
  async run(ctx) {
    const nodeModules = path.join(ctx.project.rootDir, 'node_modules');
    if (!isDirectory(nodeModules)) return { status: 'error', detail: 'node_modules ausente', hint: 'Rode `npm install` na raiz (ou o setup).' };
    // O npm grava node_modules/.package-lock.json ao final de cada install.
    const lock = path.join(ctx.project.rootDir, 'package-lock.json');
    const installedLock = path.join(nodeModules, '.package-lock.json');
    if (isFile(lock) && (!isFile(installedLock) || fs.statSync(lock).mtimeMs > fs.statSync(installedLock).mtimeMs)) {
      return { status: 'warn', detail: 'package-lock.json mudou depois do último install', hint: 'Rode `npm install` para sincronizar.' };
    }
    return { status: 'ok', detail: 'ok' };
  },
};

const submodulesCheck: Check = {
  id: 'submodules',
  label: 'Submódulos git',
  async run(ctx) {
    if (!isFile(path.join(ctx.project.rootDir, '.gitmodules'))) return { status: 'ok', detail: 'nenhum configurado' };
    const result = await ctx.exec('git', ['submodule', 'status'], { quiet: true, timeoutMs: 15000 });
    if (result.notFound) return { status: 'error', detail: 'git não encontrado', hint: 'Instale o git.' };
    if (!result.ok) return { status: 'warn', detail: 'não foi possível consultar', hint: result.stderr.trim() };
    const states = parseSubmoduleStatus(result.stdout);
    const problems = states.filter((entry) => entry.state !== 'ok');
    if (problems.length === 0) return { status: 'ok', detail: `${states.length} sincronizado(s)` };
    const severe = problems.some((entry) => entry.state === 'uninitialized' || entry.state === 'conflict');
    return { status: severe ? 'error' : 'warn', detail: problems.map((entry) => `${entry.path} (${entry.state})`).join(', '), hint: 'Rode `git submodule update --init --recursive` (ou o setup).' };
  },
};

export function envCheck(id: string, label: string, dir: string | null, candidates: string[]): Check {
  return {
    id,
    label,
    async run(ctx) {
      if (!dir) return { status: 'warn', detail: 'app não encontrado' };
      const examplePath = path.join(dir, '.env.example');
      if (!isFile(examplePath)) return { status: 'ok', detail: 'sem .env.example, nada a validar' };
      const actualPath = candidates.map((name) => path.join(dir, name)).find((file) => isFile(file));
      if (!actualPath) {
        return { status: 'error', detail: `${candidates[0]} ausente`, hint: `Copie ${path.relative(dir, examplePath)} para ${candidates[0]} e preencha os valores (o setup faz isso).` };
      }
      const diff = diffEnv(parseEnv(fs.readFileSync(examplePath, 'utf8')), parseEnv(fs.readFileSync(actualPath, 'utf8')));
      const issues: string[] = [];
      if (diff.missing.length) issues.push(`faltando: ${diff.missing.join(', ')}`);
      if (diff.placeholders.length) issues.push(`sem valor: ${diff.placeholders.join(', ')}`);
      if (issues.length === 0) return { status: 'ok', detail: path.basename(actualPath) };
      return { status: 'warn', detail: issues.join('; '), hint: `Revise ${path.relative(ctx.project.rootDir, actualPath)}.` };
    },
  };
}

const databaseCheck: Check = {
  id: 'database',
  label: 'Banco de dados',
  async run(ctx) {
    const backendDir = ctx.project.backendDir;
    if (!backendDir) return { status: 'warn', detail: 'backend não encontrado' };
    const envPath = path.join(backendDir, '.env');
    if (!isFile(envPath)) return { status: 'warn', detail: '.env do backend ausente' };
    const url = parseEnv(fs.readFileSync(envPath, 'utf8')).DATABASE_URL;
    if (!url) return { status: 'warn', detail: 'DATABASE_URL não definida' };
    const target = parseDatabaseUrl(url);
    if (!target) return { status: 'error', detail: 'DATABASE_URL inválida', hint: url };
    const open = await isPortOpen(target.host, target.port);
    const where = `${target.host}:${target.port}`;
    if (open) return { status: 'ok', detail: `${where} acessível` };
    return {
      status: 'warn',
      detail: `${where} sem resposta`,
      hint: target.isLocal ? 'Suba o Postgres local com `jaja db:start` (ou o setup).' : 'Verifique a conexão com o banco remoto e as credenciais.',
    };
  },
};

const prismaClientCheck: Check = {
  id: 'prisma-client',
  label: 'Prisma Client gerado',
  async run(ctx) {
    const candidates = [ctx.project.rootDir, ctx.project.backendDir]
      .filter((dir): dir is string => Boolean(dir))
      .map((dir) => path.join(dir, 'node_modules', '.prisma', 'client', 'index.js'));
    if (candidates.some((file) => isFile(file))) return { status: 'ok', detail: 'ok' };
    return { status: 'warn', detail: 'não gerado', hint: 'Rode `jaja db:generate` (ou o setup).' };
  },
};

export function createDoctorChecks(ctx: CommandContext): Check[] {
  return [
    nodeCheck,
    toolCheck({ id: 'npm', binary: 'npm', label: 'npm', purpose: 'Gerenciador de pacotes', install: 'vem com o Node', optional: false }),
    toolCheck({ id: 'git', binary: 'git', label: 'git', purpose: 'Controle de versão e submódulos', install: 'xcode-select --install', optional: false }),
    dockerCheck,
    toolCheck({ id: 'gh', binary: 'gh', label: 'GitHub CLI', purpose: 'PRs e workflows', install: 'brew install gh', optional: true }),
    dependenciesCheck,
    submodulesCheck,
    envCheck('env-backend', 'Env do backend', ctx.project.backendDir, ['.env']),
    envCheck('env-frontend', 'Env do frontend', ctx.project.frontendDir, ['.env', '.env.local']),
    databaseCheck,
    prismaClientCheck,
  ];
}
