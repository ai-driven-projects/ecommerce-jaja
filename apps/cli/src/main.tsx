import chalk from 'chalk';
import { render } from 'ink';
import { createRequire } from 'node:module';
import { parseArgs } from './cli/args.js';
import { createCommands } from './commands/index.js';
import type { Command } from './core/command.js';
import { PENDING_SELECTION } from './core/journey.js';
import { detectProject } from './core/project.js';
import { consolePrompter } from './core/prompt.js';
import { createRegistry } from './core/registry.js';
import { consoleReporter } from './core/reporter.js';
import { runCommand } from './core/runner.js';
import { App } from './ui/App.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

function printCommands(commands: Command[], indent = '  '): void {
  const width = Math.max(...commands.map((command) => command.id.length)) + 2;
  for (const command of commands) {
    const kind = command.kind === 'wizard' ? chalk.dim(' (wizard)') : command.kind === 'menu' ? chalk.dim(' (menu)') : command.kind === 'journey' ? chalk.dim(' (jornada)') : '';
    console.log(`${indent}${chalk.cyan(command.id.padEnd(width))}${command.description}${kind}`);
    if (command.steps) {
      console.log(`${indent}${' '.repeat(width)}${chalk.dim(`etapas: ${command.steps.map((step) => step.id + (step.defaultSelected ? '' : '*')).join(', ')}`)}`);
    }
    if (command.areas?.length) {
      console.log(`${indent}${' '.repeat(width)}${chalk.dim(`áreas: ${command.areas.map((area) => `@${area.id}`).join(', ')}`)}`);
    }
    if (command.children) printCommands(command.children, `${indent}  `);
  }
}

function printHelp(commands: Command[]): void {
  console.log(`${chalk.cyan.bold('jaja')} ${chalk.dim(`v${version}`)} · CLI de manutenção do projeto\n`);
  console.log('Uso:');
  console.log(`  ${chalk.cyan('jaja')}                 abre a paleta interativa`);
  console.log(`  ${chalk.cyan('jaja <comando>')}       executa um comando sem interface (CI/scripts)`);
  console.log('\nOpções:');
  console.log('  -y, --yes        assume "sim" nas confirmações');
  console.log('      --dry-run    mostra o que seria feito sem alterar nada');
  console.log('      --steps a,b  etapas de um wizard, ou passos e áreas (@id) de uma jornada');
  console.log('      --all        todas as etapas de um wizard ou jornada');
  console.log('      --pending    numa jornada, só os passos ainda não feitos');
  console.log('      --<opção>=v  opções próprias de um comando (ex.: scrape:products --categorias=escolar)');
  console.log('  -l, --list       lista os comandos disponíveis');
  console.log('  -h, --help       mostra esta ajuda');
  console.log('  -v, --version    mostra a versão');
  console.log('\nComandos (etapas com * não rodam por padrão):');
  printCommands(commands);
  console.log('');
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const registry = createRegistry(createCommands());
  const commands = registry.roots();

  if (args.version) {
    console.log(version);
    return 0;
  }
  if (args.help) {
    printHelp(commands);
    return 0;
  }
  if (args.list) {
    printCommands(commands);
    console.log('');
    return 0;
  }
  if (args.unknown.length > 0) {
    console.error(chalk.red(`Argumentos não reconhecidos: ${args.unknown.join(' ')}`));
    printHelp(commands);
    return 2;
  }

  const project = detectProject();

  if (args.commandId) {
    const command = registry.find(args.commandId);
    if (!command) {
      console.error(chalk.red(`Comando desconhecido: ${args.commandId}`));
      printCommands(commands);
      console.log('');
      return 2;
    }
    const controller = new AbortController();
    process.once('SIGINT', () => controller.abort());
    const selection = args.all ? command.steps?.map((step) => step.id) : args.pending ? [PENDING_SELECTION] : args.steps;
    const result = await runCommand(command, {
      project,
      yes: args.yes,
      dryRun: args.dryRun,
      selection,
      options: args.options,
      reporter: consoleReporter,
      prompter: consolePrompter,
      signal: controller.signal,
    });
    return result.status === 'error' ? 1 : 0;
  }

  if (!process.stdin.isTTY) {
    console.error(chalk.yellow('A paleta interativa precisa de um terminal. Use `jaja <comando>` ou --help.'));
    printCommands(commands);
    return 2;
  }

  const app = render(<App project={project} registry={registry} version={version} yes={args.yes} dryRun={args.dryRun} options={args.options} />, {
    exitOnCtrlC: true,
  });
  await app.waitUntilExit();
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
