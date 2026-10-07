import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { CommandContext } from '../../core/command.js';
import { findOnPath } from '../../core/exec.js';
import { sleep } from '../../core/net.js';
import { isDirectory, isFile } from '../../core/project.js';
import { diffEnv, parseEnv } from '../doctor/env.js';
import { appendMissingKeys, isGeneratableSecret, setEnvValue } from './env-repair.js';
import { GITHUB_HTTPS_PREFIX, GITHUB_SSH_INSTEAD_OF_KEY, isGithubSshGreeting, parseGitmodulesGithubUrls } from './git.js';

// ---------------------------------------------------------------- env files

export interface EnvSpec {
  label: string;
  appDir: string | null;
  target: string;
  templates: string[];
}

export interface EnvInspection extends EnvSpec {
  targetPath: string | null;
  templatePath: string | null;
  exists: boolean;
  canCreate: boolean;
}

export function envSpecs(ctx: CommandContext): EnvSpec[] {
  return [
    { label: 'backend', appDir: ctx.project.backendDir, target: '.env', templates: ['.env.example'] },
    { label: 'frontend', appDir: ctx.project.frontendDir, target: '.env', templates: ['.env.example', '.env.local.example'] },
  ];
}

export function inspectEnv(spec: EnvSpec): EnvInspection {
  if (!spec.appDir) return { ...spec, targetPath: null, templatePath: null, exists: false, canCreate: false };
  const targetPath = path.join(spec.appDir, spec.target);
  const templatePath = spec.templates.map((name) => path.join(spec.appDir as string, name)).find((file) => isFile(file)) ?? null;
  const exists = isFile(targetPath);
  return { ...spec, targetPath, templatePath, exists, canCreate: !exists && templatePath !== null };
}

/**
 * Cria os .env que ainda não existem a partir dos templates e corrige os existentes: acrescenta as
 * chaves que só estão no template (com o valor e os comentários dele) e gera valor aleatório para
 * segredos sem valor (JWT_SECRET...). Devolve quantos arquivos criou, quantos corrigiu e quantas
 * pendências sobraram (valores que só a pessoa sabe, como uma chave de API).
 */
export function ensureEnvFiles(ctx: CommandContext): { created: number; repaired: number; issues: number } {
  const rel = (file: string) => path.relative(ctx.project.rootDir, file);
  let created = 0;
  let repaired = 0;
  let issues = 0;
  for (const spec of envSpecs(ctx)) {
    const inspection = inspectEnv(spec);
    if (!inspection.appDir) {
      ctx.report.detail(`App ${spec.label} não detectado; nada a fazer.`);
      continue;
    }
    const targetPath = inspection.targetPath as string;
    if (!inspection.exists) {
      if (!inspection.templatePath) {
        ctx.report.warn(`Sem template de env para o ${spec.label} (${spec.templates.join(', ')}).`);
        continue;
      }
      if (ctx.dryRun) {
        ctx.report.info(`[dry-run] criaria ${rel(targetPath)} a partir de ${rel(inspection.templatePath)}`);
        continue;
      }
      fs.copyFileSync(inspection.templatePath, targetPath);
      created += 1;
      ctx.report.success(`Criado ${rel(targetPath)} a partir de ${rel(inspection.templatePath)}.`);
    } else {
      ctx.report.detail(`${rel(targetPath)} já existe.`);
    }
    if (!inspection.templatePath) continue;

    const templateRaw = fs.readFileSync(inspection.templatePath, 'utf8');
    const original = fs.readFileSync(targetPath, 'utf8');
    const diff = diffEnv(parseEnv(templateRaw), parseEnv(original));
    const secrets = diff.placeholders.filter(isGeneratableSecret);
    const pending = diff.placeholders.filter((key) => !isGeneratableSecret(key));

    if (diff.missing.length > 0 || secrets.length > 0) {
      if (ctx.dryRun) {
        if (diff.missing.length > 0) ctx.report.info(`[dry-run] acrescentaria a ${rel(targetPath)}: ${diff.missing.join(', ')}`);
        if (secrets.length > 0) ctx.report.info(`[dry-run] geraria valor aleatório para ${secrets.join(', ')} em ${rel(targetPath)}`);
      } else {
        let content = appendMissingKeys(original, templateRaw, diff.missing);
        for (const key of secrets) content = setEnvValue(content, key, crypto.randomBytes(32).toString('hex'));
        fs.writeFileSync(targetPath, content);
        repaired += 1;
        if (diff.missing.length > 0) ctx.report.success(`${rel(targetPath)}: acrescentadas ${diff.missing.join(', ')} (valores de ${path.basename(inspection.templatePath)}).`);
        if (secrets.length > 0) ctx.report.success(`${rel(targetPath)}: gerado valor aleatório para ${secrets.join(', ')}.`);
      }
    }
    if (pending.length > 0) {
      issues += 1;
      ctx.report.warn(`${rel(targetPath)}: preencha ${pending.join(', ')} (o setup não tem como adivinhar esses valores).`);
    }
  }
  return { created, repaired, issues };
}

// ---------------------------------------------------------------- submodules

export async function syncSubmodules(ctx: CommandContext): Promise<'ok' | 'skipped' | 'failed'> {
  const root = ctx.project.rootDir;
  const gitmodules = path.join(root, '.gitmodules');
  if (!isDirectory(path.join(root, '.git')) && !isFile(path.join(root, '.git'))) {
    ctx.report.detail('Não é um repositório git; submódulos ignorados.');
    return 'skipped';
  }
  if (!isFile(gitmodules)) {
    ctx.report.detail('Sem .gitmodules; nada a sincronizar.');
    return 'skipped';
  }
  if (!findOnPath('git')) {
    ctx.report.warn('git não encontrado; submódulos ignorados.');
    return 'failed';
  }

  const urls = parseGitmodulesGithubUrls(fs.readFileSync(gitmodules, 'utf8'));
  if (urls.length > 0) {
    const fallback = await ctx.exec('git', ['config', '--local', '--get', GITHUB_SSH_INSTEAD_OF_KEY], { quiet: true });
    if (fallback.ok && fallback.stdout.trim() === GITHUB_HTTPS_PREFIX) {
      ctx.report.detail('git já configurado para usar SSH nas URLs https do GitHub.');
    } else {
      ctx.report.info(`Testando acesso HTTPS ao GitHub (${urls.length} submódulo(s))...`);
      let reachable = false;
      for (const url of urls) {
        const probe = await ctx.exec('git', ['ls-remote', '--heads', url], { quiet: true, timeoutMs: 30000 });
        if (probe.ok) {
          reachable = true;
          break;
        }
      }
      if (reachable) {
        ctx.report.success('GitHub acessível via HTTPS.');
      } else {
        ctx.report.warn('HTTPS do GitHub indisponível. Tentando SSH...');
        const ssh = await ctx.exec('ssh', ['-T', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'StrictHostKeyChecking=accept-new', 'git@github.com'], { quiet: true, timeoutMs: 20000 });
        if (!isGithubSshGreeting(ssh.code, ssh.stdout + ssh.stderr)) {
          ctx.report.warn('SSH do GitHub também não autenticou. A atualização dos submódulos pode falhar.');
        } else if (ctx.dryRun) {
          ctx.report.info(`[dry-run] $ git config --local ${GITHUB_SSH_INSTEAD_OF_KEY} ${GITHUB_HTTPS_PREFIX}`);
        } else {
          ctx.report.info('Configurando git para usar SSH nas URLs https do GitHub (config local).');
          await ctx.exec('git', ['config', '--local', GITHUB_SSH_INSTEAD_OF_KEY, GITHUB_HTTPS_PREFIX], { quiet: true });
        }
      }
    }
  }

  if (ctx.dryRun) {
    ctx.report.info('[dry-run] $ git submodule sync --recursive && git submodule update --init --recursive');
    return 'ok';
  }
  ctx.report.info('Sincronizando e inicializando submódulos...');
  const sync = await ctx.exec('git', ['submodule', 'sync', '--recursive']);
  if (!sync.ok) return 'failed';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const update = await ctx.exec('git', ['submodule', 'update', '--init', '--recursive']);
    if (update.ok) {
      ctx.report.success('Submódulos sincronizados.');
      return 'ok';
    }
    if (attempt === 1 && !ctx.signal.aborted) {
      ctx.report.warn('Falha ao atualizar submódulos; tentando novamente...');
      await sleep(2000);
    }
  }
  return 'failed';
}

// ---------------------------------------------------------------- install / build

async function runWithRetry(ctx: CommandContext, label: string, args: string[], attempts: number): Promise<boolean> {
  if (ctx.dryRun) {
    ctx.report.info(`[dry-run] $ npm ${args.join(' ')}`);
    return true;
  }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    ctx.report.info(`${label} (tentativa ${attempt}/${attempts})`);
    const result = await ctx.exec('npm', args, { cwd: ctx.project.rootDir });
    if (result.ok) return true;
    if (ctx.signal.aborted) return false;
    ctx.report.warn(`${label} falhou na tentativa ${attempt}.`);
    if (attempt < attempts) await sleep(2000);
  }
  return false;
}

export function installDependencies(ctx: CommandContext): Promise<boolean> {
  return runWithRetry(ctx, 'npm install', ['install'], 2);
}

/**
 * Artefatos gerados que podem ficar velhos depois de um pull (ex.: `.next/dev/types` citando uma
 * rota removida) e quebrar o type check do build. Todos são recriados pelo próprio build.
 */
export function staleBuildArtifacts(ctx: CommandContext): string[] {
  const found: string[] = [];
  const packageDirs = ['apps', 'modules', 'packages'].flatMap((group) => {
    const groupDir = path.join(ctx.project.rootDir, group);
    return isDirectory(groupDir) ? fs.readdirSync(groupDir).map((name) => path.join(groupDir, name)).filter(isDirectory) : [];
  });
  for (const dir of packageDirs) {
    const next = path.join(dir, '.next');
    if (isDirectory(next)) found.push(next);
    for (const name of fs.readdirSync(dir)) if (name.endsWith('.tsbuildinfo')) found.push(path.join(dir, name));
  }
  return found;
}

/**
 * `npm run build`; se falhar, apaga os artefatos gerados que podem estar velhos (.next,
 * *.tsbuildinfo) e tenta de novo, em vez de repetir o mesmo build com o mesmo cache.
 */
export async function buildProject(ctx: CommandContext): Promise<boolean> {
  if (await runWithRetry(ctx, 'npm run build', ['run', 'build'], 1)) return true;
  if (ctx.signal.aborted) return false;
  const stale = staleBuildArtifacts(ctx);
  if (stale.length > 0) {
    ctx.report.info(`Removendo artefatos de build que podem estar velhos: ${stale.map((file) => path.relative(ctx.project.rootDir, file)).join(', ')}`);
    for (const file of stale) fs.rmSync(file, { recursive: true, force: true });
  }
  return runWithRetry(ctx, 'npm run build (após limpar artefatos)', ['run', 'build'], 1);
}
