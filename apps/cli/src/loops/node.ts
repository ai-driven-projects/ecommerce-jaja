import fs from 'node:fs';
import path from 'node:path';
import { CLI_DIR, ENGINE_DIR } from './config.js';

/** `.ts` rodando com tsx (`npm run cli`, testes); `.js` no binário compilado (`dist/`). */
const EXTENSION = path.extname(new URL(import.meta.url).pathname) || '.js';

export const WATCHER_FILE = path.join(ENGINE_DIR, `watcher${EXTENSION}`);
export const ITERATION_FILE = path.join(ENGINE_DIR, `iteration${EXTENSION}`);

/**
 * Um especificador sem caminho (`tsx`, `tsx/esm`) seria resolvido a partir da pasta
 * do filho, que roda na raiz do repositório (ou noutra): troca pela URL absoluta
 * resolvida daqui, do pacote do CLI.
 */
function absoluteSpecifier(specifier: string): string {
  if (/^(file:|\/|\.)/.test(specifier)) return specifier;
  try {
    return import.meta.resolve(specifier);
  } catch {
    return specifier;
  }
}

/**
 * Só as opções que carregam o tsx (`--require …preflight`, `--import …loader`, `--import tsx`).
 * O resto do execArgv (`--eval`, opções do executor de testes) não pode ir para o filho.
 */
export function tsxLoaders(execArgv: string[]): string[] {
  const loaders: string[] = [];
  for (let index = 0; index < execArgv.length; index++) {
    const arg = execArgv[index] as string;
    const next = execArgv[index + 1];
    if ((arg === '--require' || arg === '-r' || arg === '--import') && next?.includes('tsx')) {
      loaders.push(arg, arg === '--import' ? absoluteSpecifier(next) : next);
      index++;
    } else if (/^--(require|import)=/.test(arg) && arg.includes('tsx')) {
      const [flag, value = ''] = arg.split(/=(.*)/s);
      loaders.push(flag === '--import' ? `${flag}=${absoluteSpecifier(value)}` : arg);
    }
  }
  return loaders;
}

/**
 * Comando para rodar um arquivo do motor num processo novo. Um `.js` compilado
 * roda direto no node; um `.ts` reaproveita o loader do tsx com que este processo
 * já roda (`process.execArgv`) ou, sem ele, o binário do tsx do workspace.
 */
export function nodeCommand(
  script: string,
  args: string[] = [],
  execArgv = process.execArgv,
): { command: string; args: string[] } {
  if (script.endsWith('.js')) return { command: process.execPath, args: [script, ...args] };
  const loaders = tsxLoaders(execArgv);
  if (loaders.length) return { command: process.execPath, args: [...loaders, script, ...args] };
  const candidates = [
    path.join(CLI_DIR, 'node_modules/.bin/tsx'),
    path.resolve(CLI_DIR, '../../node_modules/.bin/tsx'),
  ];
  const tsx = candidates.find((candidate) => fs.existsSync(candidate)) ?? 'tsx';
  return { command: tsx, args: [script, ...args] };
}

/** Este arquivo foi chamado direto (`node … arquivo`), e não importado? */
export const isEntry = (file: string) => !!process.argv[1] && path.resolve(process.argv[1]) === path.resolve(file);
