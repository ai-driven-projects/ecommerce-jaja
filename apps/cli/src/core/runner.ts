import type { Command, CommandContext, CommandResult, Prompter, Reporter } from './command.js';
import { exec } from './exec.js';
import type { ProjectInfo } from './project.js';
import { createReport } from './reporter.js';

export interface RunOptions {
  project: ProjectInfo;
  yes: boolean;
  dryRun?: boolean;
  /** Seleção de etapas para wizards. */
  selection?: string[];
  /** Opções livres da linha de comando. */
  options?: Record<string, string>;
  reporter: Reporter;
  prompter: Prompter;
  signal?: AbortSignal;
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Monta o contexto de execução; usado pelo runner e pela detecção de estado das jornadas. */
export function createCommandContext(options: RunOptions): CommandContext {
  const report = createReport(options.reporter);
  const signal = options.signal ?? new AbortController().signal;
  return {
    project: options.project,
    yes: options.yes,
    dryRun: options.dryRun ?? false,
    selection: options.selection,
    options: options.options ?? {},
    report,
    signal,
    exec: (cmd, args, execOptions = {}) =>
      exec(cmd, args, {
        cwd: options.project.rootDir,
        signal,
        onOutput: execOptions.quiet ? undefined : (line) => report.detail(line),
        ...execOptions,
      }),
    confirm: async (question, defaultValue = true) => {
      if (options.yes) {
        report.detail(`${question} → ${defaultValue ? 'sim' : 'não'} (--yes)`);
        return defaultValue;
      }
      return options.prompter.confirm(question, defaultValue);
    },
    ask: async (question, defaultValue, askOptions) => {
      if (options.yes) {
        report.detail(`${question} → ${askOptions?.secret ? '(padrão)' : defaultValue || '(vazio)'} (--yes)`);
        return defaultValue;
      }
      return options.prompter.ask(question, defaultValue, askOptions);
    },
    pick: async (question, choices, config = {}) => {
      const defaults = (config.defaults ?? []).filter((id) => choices.some((choice) => choice.id === id));
      if (options.yes) {
        report.detail(`${question} → ${defaults.length > 0 ? defaults.join(', ') : '(nenhuma)'} (--yes)`);
        return defaults;
      }
      return options.prompter.pick(question, choices, { ...config, defaults });
    },
  };
}

export async function runCommand(command: Command, options: RunOptions): Promise<CommandResult> {
  const ctx = createCommandContext(options);
  const { report, signal } = ctx;

  report.title(options.dryRun ? `${command.title} (dry-run)` : command.title);
  const started = Date.now();
  try {
    const result = await command.run(ctx);
    const suffix = `${result.summary} (${formatDuration(Date.now() - started)})`;
    if (result.status === 'ok') report.success(suffix);
    else if (result.status === 'warn') report.warn(suffix);
    else report.error(suffix);
    return result;
  } catch (error) {
    if (signal.aborted) {
      report.warn('Execução cancelada.');
      return { status: 'warn', summary: 'Cancelado' };
    }
    const message = error instanceof Error ? error.message : String(error);
    report.error(message);
    return { status: 'error', summary: message };
  }
}
