import chalk from 'chalk';
import readline from 'node:readline';
import type { PickOption, Prompter } from './command.js';

const YES = new Set(['y', 'yes', 's', 'sim']);
const NO = new Set(['n', 'no', 'nao', 'não']);

export function parseYesNo(answer: string, defaultValue: boolean): boolean {
  const normalized = answer.trim().toLowerCase();
  if (normalized === '') return defaultValue;
  if (YES.has(normalized)) return true;
  if (NO.has(normalized)) return false;
  return defaultValue;
}

/**
 * Interpreta a resposta de um `pick` no console: números (1-based) ou ids, separados por vírgula,
 * `*`/`todos` para tudo e vazio para o padrão. Ids desconhecidos são ignorados.
 */
export function parsePickAnswer(answer: string, options: PickOption[], defaults: string[], multi: boolean): string[] {
  const text = answer.trim().toLowerCase();
  if (text === '') return defaults;
  if (multi && (text === '*' || text === 'todos' || text === 'todas' || text === 'all')) return options.map((option) => option.id);
  const chosen = new Set<string>();
  for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
    const index = /^\d+$/.test(token) ? Number(token) - 1 : -1;
    const option = index >= 0 ? options[index] : options.find((item) => item.id.toLowerCase() === token);
    if (option) chosen.add(option.id);
  }
  const ordered = options.filter((option) => chosen.has(option.id)).map((option) => option.id);
  return multi ? ordered : ordered.slice(0, 1);
}

/** Prompter do modo headless: pergunta no terminal; sem TTY assume o padrão. */
export const consolePrompter: Prompter = {
  confirm(question, defaultValue) {
    if (!process.stdin.isTTY) {
      process.stdout.write(chalk.dim(`? ${question} → ${defaultValue ? 'sim' : 'não'} (sem terminal)\n`));
      return Promise.resolve(defaultValue);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultValue ? '(S/n)' : '(s/N)';
    return new Promise((resolve) => {
      rl.question(`${chalk.cyan('?')} ${question} ${chalk.dim(suffix)} `, (answer) => {
        rl.close();
        resolve(parseYesNo(answer, defaultValue));
      });
    });
  },
  ask(question, defaultValue, options) {
    const secret = options?.secret === true;
    const shownDefault = secret ? (defaultValue ? '(mantém o atual)' : '(vazio)') : defaultValue || '(vazio)';
    if (!process.stdin.isTTY) {
      process.stdout.write(chalk.dim(`? ${question} → ${shownDefault} (sem terminal)\n`));
      return Promise.resolve(defaultValue);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const suffix = defaultValue ? `[${secret ? 'Enter mantém o atual' : defaultValue}]` : '';
    const prompt = `${chalk.cyan('?')} ${question} ${chalk.dim(suffix)} `;
    if (secret) {
      // Ecoa só o prompt; os caracteres digitados ficam ocultos.
      const mutable = rl as readline.Interface & { _writeToOutput?: (text: string) => void };
      mutable._writeToOutput = (text: string) => {
        if (text.startsWith(prompt) || text.includes('\n')) process.stdout.write(text.startsWith(prompt) ? prompt : text);
      };
    }
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        if (secret) process.stdout.write('\n');
        resolve(answer.trim() || defaultValue);
      });
    });
  },
  pick(question, options, config) {
    const multi = config.multi === true;
    const defaults = config.defaults ?? [];
    const required = config.required ?? multi;
    const width = String(options.length).length;
    process.stdout.write(`${chalk.cyan('?')} ${question}\n`);
    options.forEach((option, index) => {
      const mark = defaults.includes(option.id) ? chalk.green('●') : chalk.dim('○');
      const line = `  ${mark} ${chalk.dim(String(index + 1).padStart(width))}  ${option.label}${option.description ? chalk.dim(`  ${option.description}`) : ''}`;
      process.stdout.write(`${line}\n`);
    });
    const hint = multi ? 'números ou ids separados por vírgula, * para todos' : 'número ou id';
    if (!process.stdin.isTTY) {
      process.stdout.write(chalk.dim(`  → ${defaults.length > 0 ? defaults.join(', ') : '(nenhuma)'} (sem terminal)\n`));
      return Promise.resolve(defaults);
    }
    const askOnce = (): Promise<string[]> =>
      new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(`${chalk.cyan('?')} Escolha (${hint}${defaults.length > 0 ? '; Enter mantém o padrão' : ''}): `, (answer) => {
          rl.close();
          resolve(parsePickAnswer(answer, options, defaults, multi));
        });
      });
    const loop = async (): Promise<string[]> => {
      const chosen = await askOnce();
      if (required && chosen.length === 0) {
        process.stdout.write(chalk.yellow('  Escolha ao menos uma opção.\n'));
        return loop();
      }
      return chosen;
    };
    return loop();
  },
};
