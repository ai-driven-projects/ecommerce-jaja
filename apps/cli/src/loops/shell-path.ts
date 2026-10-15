import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { onPath } from './process.js';

let cache: string | null | undefined;

/**
 * O PATH que o shell do usuário monta (login + interativo: .zprofile e .zshrc).
 * O CLI pode ter sido aberto por um terminal ou app que não leu o .zshrc, e é
 * lá que costumam estar nvm, asdf, fnm, Homebrew… Lido uma vez por processo.
 */
export function userShellPath(): string | undefined {
  if (cache !== undefined) return cache ?? undefined;
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- leitura em runtime, não input de build
  const shell = process.env.SHELL || '/bin/zsh';
  const result = spawnSync(shell, ['-ilc', 'printf "\\n__PATH__%s__FIM__\\n" "$PATH"'], {
    encoding: 'utf8',
    timeout: 8000,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  // temas de prompt e avisos do .zshrc também escrevem na saída: só vale o que está entre os marcadores
  const match = result.stdout?.match(/__PATH__(.*)__FIM__/);
  cache = match?.[1] || null;
  return cache ?? undefined;
}

/** Só para os testes. */
export const forgetUserShellPath = () => (cache = undefined);

/** Junta PATHs sem repetir pastas, na ordem. */
export function joinPaths(...paths: (string | undefined)[]): string {
  const seen = new Set<string>();
  for (const p of paths) for (const dir of (p ?? '').split(path.delimiter)) if (dir) seen.add(dir);
  return [...seen].join(path.delimiter);
}

/**
 * O PATH com que o loop vai rodar: o do CLI e, se faltar algum comando, também o
 * do shell do usuário. Devolve os comandos que não estão em nenhum dos dois.
 */
// eslint-disable-next-line turbo/no-undeclared-env-vars -- PATH do processo, não input de build
export function pathForLoop(commands: string[], current = process.env.PATH ?? ''): { path: string; missing: string[] } {
  const missing = commands.filter((command) => !onPath(command, current));
  if (!missing.length) return { path: current, missing };
  const full = joinPaths(current, userShellPath());
  return { path: full, missing: commands.filter((command) => !onPath(command, full)) };
}
