import { spawnSync } from 'node:child_process';

// eslint-disable-next-line turbo/no-undeclared-env-vars -- leitura em runtime, não input de build
export const configuredEditor = () => process.env.VISUAL?.trim() || process.env.EDITOR?.trim() || '';

/**
 * Abre o arquivo no $VISUAL/$EDITOR e espera fechar. Sai do modo raw antes e
 * volta depois: o editor precisa do terminal inteiro.
 */
export function openInEditor(file: string, setRawMode: (enabled: boolean) => void): string | undefined {
  const editor = configuredEditor();
  if (!editor) return `defina $EDITOR, ou edite ${file} por fora: a tela relê o plano sozinha`;
  const [command = '', ...args] = editor.split(/\s+/);
  setRawMode(false);
  process.stdout.write('\x1b[?25h');
  try {
    const result = spawnSync(command, [...args, file], { stdio: 'inherit' });
    if (result.error) return `não consegui abrir ${editor}: ${result.error.message}`;
    return undefined;
  } finally {
    process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');
    setRawMode(true);
  }
}
