/**
 * Proteção contra correções que "resolvem" desligando verificações: testes
 * pulados ou focados, supressões de analisador e lint, testes apagados.
 *
 * O motor tira um instantâneo do que está alterado antes de uma sessão de
 * correção ou recuperação e compara com o depois: só conta o que a sessão trouxe.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Supressões em qualquer linguagem do monorepo (TS/JS, Dart, Python, Java/Kotlin). */
export const SUPPRESSION_PATTERN =
  /\.skip\b|\.only\(|\bx(it|describe|test)\(|\b(it|test|describe)\.todo\(|@Skip\b|\bskip:\s*(true|['"`])|ignore_for_file|\/\/\s*ignore:|eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|#\s*noqa|@pytest\.mark\.skip|@Disabled\b/;

export const TEST_FILE = /(_test\.|\.test\.|\.spec\.|(^|\/)tests?\/)/;

const MAX_UNTRACKED = 200 * 1024;
const MAX_FINDINGS = 10;

export interface Snapshot {
  /** Linhas adicionadas (em relação ao HEAD) por arquivo. */
  added: Map<string, Set<string>>;
  deleted: Set<string>;
  /** Conteúdo dos arquivos novos ainda não rastreados. */
  untracked: Map<string, Set<string>>;
}

const git = (root: string, args: string[]) => {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
};

/** Linhas adicionadas por arquivo, a partir de um `git diff -U0`. */
export function addedLines(diff: string): Map<string, Set<string>> {
  const byFile = new Map<string, Set<string>>();
  let current: Set<string> | undefined;
  for (const line of diff.split('\n')) {
    const file = line.match(/^\+\+\+ b\/(.+)$/);
    if (file?.[1]) {
      current = new Set();
      byFile.set(file[1], current);
    } else if (line.startsWith('+++')) current = undefined;
    else if (line.startsWith('+') && current) current.add(line.slice(1).trim());
  }
  return byFile;
}

export function snapshot(root: string, paths: string[]): Snapshot {
  const empty: Snapshot = { added: new Map(), deleted: new Set(), untracked: new Map() };
  if (!paths.length) return empty;
  const added = addedLines(git(root, ['diff', '-U0', '--no-color', 'HEAD', '--', ...paths]));
  const deleted = new Set<string>();
  const untracked = new Map<string, Set<string>>();
  for (const line of git(root, ['status', '--porcelain', '--untracked-files=all', '--', ...paths]).split('\n')) {
    if (!line) continue;
    const state = line.slice(0, 2);
    const file = line.slice(3);
    if (state.includes('D')) deleted.add(file);
    if (state === '??') {
      try {
        const full = path.join(root, file);
        if (fs.statSync(full).size <= MAX_UNTRACKED) {
          untracked.set(
            file,
            new Set(
              fs
                .readFileSync(full, 'utf8')
                .split('\n')
                .map((x) => x.trim()),
            ),
          );
        }
      } catch {
        // arquivo sumiu entre o status e a leitura
      }
    }
  }
  return { added, deleted, untracked };
}

/** O que a sessão trouxe que desliga verificações: `arquivo: linha`. Vazio = nada. */
export function disablements(before: Snapshot, after: Snapshot): string[] {
  const findings: string[] = [];
  const check = (file: string, lines: Set<string>, alreadyThere?: Set<string>) => {
    for (const line of lines) {
      if (alreadyThere?.has(line)) continue;
      if (SUPPRESSION_PATTERN.test(line)) findings.push(`${file}: ${line.slice(0, 160)}`);
    }
  };
  for (const [file, lines] of after.added) check(file, lines, before.added.get(file));
  for (const [file, lines] of after.untracked) check(file, lines, before.untracked.get(file));
  for (const file of after.deleted) {
    if (!before.deleted.has(file) && TEST_FILE.test(file)) findings.push(`${file}: arquivo de teste apagado`);
  }
  return findings.slice(0, MAX_FINDINGS);
}
