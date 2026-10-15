import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  buildPathspecs,
  commitPaths,
  iterationPathspecs,
  outsideScope,
  pathspecsThatMustBeClean,
  pendingReadySpecs,
  status,
} from '../../src/loops/git.js';

test('pathspecs: escopo, pasta do loop e só os arquivos OpenSpec da change', () => {
  const base = {
    scope: ['apps/backend'],
    extras: ['openspec/loops/m'],
    changeExists: true,
    capabilities: ['orders', 'orders'],
    specExists: () => true,
  };
  assert.deepEqual(buildPathspecs({ ...base, change: 'm-01-x' }), [
    'apps/backend',
    'openspec/loops/m',
    'openspec/changes/m-01-x',
    'openspec/specs/orders',
  ]);
  assert.deepEqual(buildPathspecs({ ...base, change: 'm-01-x', scopeOnly: true }), [
    'apps/backend',
    'openspec/loops/m',
  ]);
  const archived = buildPathspecs({
    ...base,
    change: 'm-01-x',
    changeExists: false,
    archived: 'openspec/changes/archive/2026-10-05-m-01-x',
    capabilities: ['orders', 'nova'],
    specExists: (capability) => capability === 'orders',
  });
  assert.deepEqual(archived.slice(2), ['openspec/changes/archive/2026-10-05-m-01-x', 'openspec/specs/orders']);
  assert.ok(!archived.some((p) => p.startsWith('apps/frontend') || p.startsWith('packages')));
});

test('fora do escopo exclui o escopo e o openspec', () => {
  assert.deepEqual(outsideScope(['apps/backend']), ['.', ':(exclude)apps/backend', ':(exclude)openspec']);
});

test('commit inclui só o escopo e a change, nunca o resto do repositório', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-git-'));
  const g = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  const write = (relative: string, text = 'x') => {
    fs.mkdirSync(path.dirname(path.join(repo, relative)), { recursive: true });
    fs.writeFileSync(path.join(repo, relative), text);
  };
  write('README.md');
  g('add', '.');
  g('commit', '-qm', 'base');

  write('apps/backend/a.ts');
  write('apps/frontend/b.ts');
  write('openspec/changes/m-01-x/tasks.md');
  write('openspec/changes/outra/tasks.md');
  write('openspec/loops/m/loop.json', '{}');
  const specs = iterationPathspecs(repo, { scope: ['apps/backend'], extras: ['openspec/loops/m'], change: 'm-01-x' });
  const result = commitPaths(repo, 'feat(backend): x', specs, 'Co-Authored-By: Claude <noreply@anthropic.com>');
  assert.deepEqual(result?.files.sort(), [
    'apps/backend/a.ts',
    'openspec/changes/m-01-x/tasks.md',
    'openspec/loops/m/loop.json',
  ]);
  assert.deepEqual(status(repo, outsideScope(['apps/backend'])), ['?? apps/frontend/']);
  assert.equal(commitPaths(repo, 'nada', specs, 't'), null);
  assert.match(g('log', '-1', '--format=%B'), /Co-Authored-By: Claude/);
});

test('escopo limpo ignora as specs prontas ainda não entregues (são do usuário e o loop as commita)', () => {
  const stages = [
    { change: 'raiz-01-a', readySpec: true, status: 'pending' },
    { change: 'raiz-02-b', status: 'pending' },
    { change: 'velha', readySpec: true, status: 'delivered' },
  ];
  assert.deepEqual(pendingReadySpecs(stages), ['raiz-01-a']);
  assert.deepEqual(pathspecsThatMustBeClean(['apps/backend'], 'raiz', pendingReadySpecs(stages)), [
    'apps/backend',
    'openspec/changes/raiz-*',
    ':(exclude)openspec/loops/raiz',
    ':(exclude)openspec/changes/raiz-01-a',
  ]);
});
