import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  archivedDir,
  changeExists,
  countTasks,
  pendingSpecs,
  taskBatches,
  taskGroups,
} from '../../src/loops/openspec.js';

test('tarefas abertas e feitas', () => {
  const tasks = countTasks('## 1\n- [x] 1.1 feito\n- [ ] 1.2 aberto\n  - [X] 1.3 feito\ntexto - [ ] não conta');
  assert.deepEqual(tasks, { done: 2, total: 3, open: ['1.2 aberto'] });
});

test('grupos do tasks.md, com tarefas antes do primeiro grupo', () => {
  const groups = taskGroups('- [ ] solta\n## 1. Base\n- [x] 1.1\n- [ ] 1.2\n## 2. Tela\n- [ ] 2.1');
  assert.deepEqual(
    groups.map((group) => [group.title, group.done, group.open.length]),
    [
      ['', 0, 1],
      ['1. Base', 1, 1],
      ['2. Tela', 0, 1],
    ],
  );
});

test('lotes juntam grupos até o limite sem partir grupo e pulam grupos prontos', () => {
  const group = (title: string, open: number, done = 0) => ({
    title,
    done,
    open: Array.from({ length: open }, (_, i) => `${title}.${i}`),
  });
  const batches = taskBatches([group('1', 4), group('2', 0, 5), group('3', 5), group('4', 12), group('5', 1)], 10);
  assert.deepEqual(
    batches.map((batch) => batch.map((g) => g.title)),
    [['1', '3'], ['4'], ['5']],
  );
  assert.deepEqual(taskBatches([group('1', 0, 3)], 10), []);
});

test('pasta arquivada é a mais recente com o nome exato', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-os-'));
  for (const dir of ['2026-10-01-m-01-x', '2026-10-05-m-01-x', '2026-10-05-outra-m-01-xy', '2026-10-07-outra-m-01-x']) {
    fs.mkdirSync(path.join(root, 'openspec/changes/archive', dir), { recursive: true });
  }
  assert.equal(archivedDir(root, 'm-01-x'), 'openspec/changes/archive/2026-10-05-m-01-x');
  assert.equal(archivedDir(root, 'm-02-y'), undefined);
});

test('specs pendentes: changes abertas com proposal ou tasks, com progresso e resumo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'specs-'));
  const write = (relative: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), text);
  };
  write('openspec/changes/b-busca/proposal.md', '# Busca\n\n## Why\n\n- A busca atual é lenta.\n');
  write('openspec/changes/b-busca/tasks.md', '## 1. A\n- [x] 1.1 a\n- [ ] 1.2 b\n');
  write('openspec/changes/a-so-tasks/tasks.md', '- [ ] 1 x\n');
  write('openspec/changes/vazia/README.md', 'nada');
  write('openspec/changes/archive/2026-01-01-velha/proposal.md', '## Why\n\nx');
  const specs = pendingSpecs(root);
  assert.deepEqual(
    specs.map((spec) => spec.name),
    ['a-so-tasks', 'b-busca'],
  );
  assert.deepEqual(specs[1]?.tasks, { done: 1, total: 2, open: ['1.2 b'] });
  assert.equal(specs[1]?.summary, 'A busca atual é lenta.');
  assert.ok(changeExists(root, 'velha') && changeExists(root, 'b-busca') && !changeExists(root, 'nenhuma'));
});
