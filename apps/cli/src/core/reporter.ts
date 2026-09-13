import chalk from 'chalk';
import type { LogEntry, LogLevel, ReportApi, Reporter, StepStatus } from './command.js';

export function createReport(reporter: Reporter): ReportApi {
  const emit = (level: LogLevel) => (message: string) => reporter.log({ level, message });
  return {
    title: emit('title'),
    info: emit('info'),
    detail: emit('detail'),
    success: emit('success'),
    warn: emit('warn'),
    error: emit('error'),
    step: (id, label, status) => reporter.log({ level: 'step', message: label, step: { id, label, status } }),
  };
}

export const LEVEL_ICON: Record<LogLevel, string> = {
  title: '',
  info: '•',
  detail: ' ',
  success: '✔',
  warn: '▲',
  error: '✖',
  step: '›',
};

export const STEP_ICON: Record<StepStatus, string> = {
  pending: '○',
  running: '◐',
  ok: '✔',
  warn: '▲',
  error: '✖',
  skipped: '–',
};

export function formatEntry(entry: LogEntry): string {
  const icon = LEVEL_ICON[entry.level];
  switch (entry.level) {
    case 'title':
      return `\n${chalk.cyan.bold(entry.message)}`;
    case 'detail':
      return chalk.dim(`    ${entry.message}`);
    case 'success':
      return `${chalk.green(icon)} ${entry.message}`;
    case 'warn':
      return `${chalk.yellow(icon)} ${entry.message}`;
    case 'error':
      return `${chalk.red(icon)} ${entry.message}`;
    case 'step': {
      const status = entry.step?.status ?? 'pending';
      const mark = STEP_ICON[status];
      const colored =
        status === 'ok' ? chalk.green(mark) : status === 'error' ? chalk.red(mark) : status === 'warn' ? chalk.yellow(mark) : chalk.cyan(mark);
      return `\n${colored} ${chalk.bold(entry.message)} ${chalk.dim(`[${status}]`)}`;
    }
    default:
      return `${chalk.blue(icon)} ${entry.message}`;
  }
}

/** Reporter usado no modo headless (`jaja <comando>`). */
export const consoleReporter: Reporter = {
  log(entry) {
    const stream = entry.level === 'error' ? process.stderr : process.stdout;
    stream.write(`${formatEntry(entry)}\n`);
  },
};
