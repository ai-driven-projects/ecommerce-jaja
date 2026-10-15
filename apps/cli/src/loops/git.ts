import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { archivedDir, subdirs } from './openspec.js';

export function git(root: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

export const currentBranch = (root: string) => git(root, ['branch', '--show-current']);
export const head = (root: string) => git(root, ['rev-parse', 'HEAD']);
export const short = (hash: string) => hash.slice(0, 9);

/** `git status --porcelain` restrito aos pathspecs. Sem pathspecs, nada. */
export function status(root: string, pathspecs: string[]): string[] {
  if (!pathspecs.length) return [];
  return git(root, ['status', '--porcelain', '--', ...pathspecs])
    .split('\n')
    .filter(Boolean);
}

/** Tudo o que está fora do que o loop pode commitar. */
export const outsideScope = (scope: string[]) => ['.', ...scope.map((p) => `:(exclude)${p}`), ':(exclude)openspec'];

/**
 * Alterações em pastas do escopo ou em changes do loop: uma iteração nova só
 * começa sem elas. Ficam de fora:
 * - a pasta do próprio loop (plano.md e loop.json): o vigia grava o loop.json
 *   entre as iterações, e ela entra no commit seguinte do loop (importa quando o
 *   escopo inclui `openspec`);
 * - as specs prontas: são do usuário, podem nem estar versionadas, e o próprio
 *   loop as commita quando chega a vez delas.
 */
export const pathspecsThatMustBeClean = (scope: string[], loopName: string, readySpecs: string[] = []) => [
  ...scope,
  `openspec/changes/${loopName}-*`,
  `:(exclude)openspec/loops/${loopName}`,
  ...readySpecs.map((change) => `:(exclude)openspec/changes/${change}`),
];

/** As changes das etapas ainda não entregues marcadas como spec pronta. */
export const pendingReadySpecs = (stages: { change: string; readySpec?: boolean; status: string }[]) =>
  stages.filter((stage) => stage.readySpec && stage.status !== 'delivered').map((stage) => stage.change);

/**
 * O que o loop pode commitar: as pastas do escopo, a pasta do loop e só os
 * arquivos OpenSpec da change atual — a pasta dela, a pasta arquivada e as specs
 * principais que ela sincroniza. Trabalho de outras pessoas nunca entra.
 */
export function buildPathspecs(p: {
  scope: string[];
  extras: string[];
  scopeOnly?: boolean;
  change?: string;
  changeExists: boolean;
  archived?: string;
  capabilities: string[];
  specExists: (capability: string) => boolean;
}): string[] {
  // pastas ignoradas (build) ficam de fora pelo .gitignore. Não citar num :(exclude):
  // o git add falha quando um pathspec nomeia uma pasta ignorada.
  const specs = [...p.scope, ...p.extras];
  if (p.scopeOnly || !p.change) return specs;
  if (p.changeExists) specs.push(`openspec/changes/${p.change}`);
  if (p.archived) specs.push(p.archived);
  for (const capability of [...new Set(p.capabilities)].sort())
    if (p.specExists(capability)) specs.push(`openspec/specs/${capability}`);
  return specs;
}

/** Existe no disco ou no índice do git (uma pasta apagada ainda precisa entrar no commit). */
function exists(root: string, relative: string): boolean {
  return fs.existsSync(path.join(root, relative)) || git(root, ['ls-files', '--', relative]).length > 0;
}

export function iterationPathspecs(
  root: string,
  options: { scope: string[]; extras: string[]; change?: string; scopeOnly?: boolean },
): string[] {
  const { change } = options;
  const archived = change ? archivedDir(root, change) : undefined;
  return buildPathspecs({
    ...options,
    scope: options.scope.filter((p) => exists(root, p)),
    extras: options.extras.filter((p) => exists(root, p)),
    changeExists: !!change && exists(root, `openspec/changes/${change}`),
    archived,
    capabilities: change
      ? [...subdirs(root, `openspec/changes/${change}/specs`), ...(archived ? subdirs(root, `${archived}/specs`) : [])]
      : [],
    specExists: (capability) => exists(root, `openspec/specs/${capability}`),
  });
}

export interface Commit {
  hash: string;
  files: string[];
}

/** Commita só os pathspecs dados, sem tocar no que mais estiver no índice. Retorna null se não havia nada. */
export function commitPaths(root: string, message: string, pathspecs: string[], trailer: string): Commit | null {
  if (!pathspecs.length) return null;
  git(root, ['add', '-A', '--', ...pathspecs]);
  const diff = spawnSync('git', ['diff', '--cached', '--quiet', '--', ...pathspecs], { cwd: root });
  if (diff.status === 0) return null;
  git(root, ['commit', '-q', '-m', message, '-m', trailer, '--', ...pathspecs]);
  const hash = head(root);
  const files = git(root, ['show', '--name-only', '--format=', hash]).split('\n').filter(Boolean);
  return { hash, files };
}
