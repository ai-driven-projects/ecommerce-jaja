import type { CommandContext } from '../../core/command.js';
import { extractVersion, findOnPath } from '../../core/exec.js';
import { sleep } from '../../core/net.js';
import { isDirectory } from '../../core/project.js';

export interface DockerStatus {
  installed: boolean;
  running: boolean;
  version: string | null;
  composeVersion: string | null;
}

/** Docker instalado? Daemon respondendo? Plugin compose disponível? */
export async function inspectDocker(ctx: CommandContext): Promise<DockerStatus> {
  if (!findOnPath('docker')) return { installed: false, running: false, version: null, composeVersion: null };
  const info = await ctx.exec('docker', ['info', '--format', '{{.ServerVersion}}'], { quiet: true, timeoutMs: 15000 });
  if (!info.ok) return { installed: true, running: false, version: null, composeVersion: null };
  const compose = await ctx.exec('docker', ['compose', 'version', '--short'], { quiet: true, timeoutMs: 10000 });
  return { installed: true, running: true, version: info.stdout.trim() || 'ok', composeVersion: compose.ok ? extractVersion(compose.stdout) : null };
}

const DOCKER_APP = '/Applications/Docker.app';

/**
 * Garante que o daemon do Docker está no ar. No macOS, se o Docker Desktop estiver instalado
 * mas parado, abre o aplicativo e espera o daemon responder (até `waitMs`).
 */
export async function ensureDockerRunning(ctx: CommandContext, waitMs = 90000): Promise<DockerStatus> {
  const status = await inspectDocker(ctx);
  if (!status.installed) {
    ctx.report.error('Docker não encontrado no PATH.');
    ctx.report.detail('Instale o Docker Desktop: https://www.docker.com/products/docker-desktop/');
    return status;
  }
  if (status.running) {
    ctx.report.success(`Docker no ar (engine ${status.version}${status.composeVersion ? `, compose ${status.composeVersion}` : ''}).`);
    return status;
  }
  if (process.platform !== 'darwin' || !isDirectory(DOCKER_APP)) {
    ctx.report.error('O daemon do Docker não está respondendo. Inicie o Docker e rode de novo.');
    return status;
  }
  if (ctx.dryRun) {
    ctx.report.info('[dry-run] $ open -a Docker');
    return status;
  }
  ctx.report.info('Docker Desktop parado. Abrindo o aplicativo e aguardando o daemon...');
  const open = await ctx.exec('open', ['-a', 'Docker'], { quiet: true });
  if (!open.ok) {
    ctx.report.error('Não foi possível abrir o Docker Desktop.');
    return status;
  }
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline && !ctx.signal.aborted) {
    await sleep(3000);
    const again = await inspectDocker(ctx);
    if (again.running) {
      ctx.report.success(`Docker iniciado (engine ${again.version}).`);
      return again;
    }
  }
  ctx.report.error(`O Docker não respondeu em ${Math.round(waitMs / 1000)}s. Verifique o Docker Desktop e rode de novo.`);
  return inspectDocker(ctx);
}
