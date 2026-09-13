import type { CommandContext } from './command.js';
import type { ExecOptions, ExecResult } from './exec.js';

function quote(arg: string): string {
  return /[\s"'$`\\]/.test(arg) ? `'${arg.replace(/'/g, `'\\''`)}'` : arg;
}

export function formatCommand(command: string, args: string[]): string {
  return [command, ...args.map(quote)].join(' ');
}

/**
 * Executa um comando com efeito externo, ou só mostra o que rodaria em `--dry-run`.
 * Leituras (describe, list, status) devem usar `ctx.exec` direto.
 */
export async function execOrDry(
  ctx: CommandContext,
  command: string,
  args: string[],
  options: ExecOptions & { label?: string; secretInput?: boolean } = {},
): Promise<ExecResult> {
  const shown = formatCommand(command, args) + (options.input !== undefined ? (options.secretInput ? ' < (valor oculto)' : ' < stdin') : '');
  if (ctx.dryRun) {
    ctx.report.info(`[dry-run] $ ${shown}`);
    return { ok: true, code: 0, stdout: '', stderr: '', notFound: false, timedOut: false };
  }
  ctx.report.info(`$ ${options.label ?? shown}`);
  return ctx.exec(command, args, options);
}
