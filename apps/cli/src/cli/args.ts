export interface CliArgs {
  commandId: string | null;
  yes: boolean;
  dryRun: boolean;
  /** Ids de etapas para um wizard (`--steps a,b`). `undefined` = padrões; `[]` com `--all` significa todas. */
  steps?: string[];
  all: boolean;
  /** Jornadas: roda só os passos ainda não feitos. */
  pending: boolean;
  help: boolean;
  list: boolean;
  version: boolean;
  /** Opções livres (`--nome=valor` ou `--nome valor`), interpretadas por cada comando. Flag sem valor vira `'true'`. */
  options: Record<string, string>;
  /** Argumentos posicionais excedentes. */
  unknown: string[];
}

const KNOWN_FLAGS = new Set(['--yes', '-y', '--dry-run', '--all', '--pending', '--help', '-h', '--list', '-l', '--version', '-v', '--steps']);

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { commandId: null, yes: false, dryRun: false, all: false, pending: false, help: false, list: false, version: false, options: {}, unknown: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (arg.startsWith('--steps=')) {
      args.steps = arg.slice('--steps='.length).split(',').map((item) => item.trim()).filter(Boolean);
      continue;
    }
    if (arg === '--steps') {
      const value = argv[index + 1];
      args.steps = value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
      index += 1;
      continue;
    }
    switch (arg) {
      case '--yes':
      case '-y':
        args.yes = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--all':
        args.all = true;
        break;
      case '--pending':
        args.pending = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      case '--list':
      case '-l':
        args.list = true;
        break;
      case '--version':
      case '-v':
        args.version = true;
        break;
      default:
        if (arg.startsWith('--') && !KNOWN_FLAGS.has(arg)) {
          // Opção livre: `--nome=valor`, `--nome valor` ou `--nome` (true).
          const eq = arg.indexOf('=');
          const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
          if (eq !== -1) args.options[name] = arg.slice(eq + 1);
          else if (argv[index + 1] !== undefined && !(argv[index + 1] as string).startsWith('-')) {
            args.options[name] = argv[index + 1] as string;
            index += 1;
          } else args.options[name] = 'true';
        } else if (arg.startsWith('-')) args.unknown.push(arg);
        else if (args.commandId === null) args.commandId = arg;
        else args.unknown.push(arg);
    }
  }
  return args;
}
