import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { DEFAULT_STEPS } from '../../src/loops/config.js';
import { acquireLock, liveLock, releaseLock } from '../../src/loops/lock.js';
import {
  approvePlan,
  effectiveStatus,
  listLoops,
  loopPaths,
  markArchived,
  normalizeLoop,
  planDivergences,
  saveLoop,
  specsForNewLoop,
  validateLoopName,
} from '../../src/loops/loops.js';
import { parsePlan } from '../../src/loops/plan.js';
import { exampleLoop, stage } from './fixtures.js';

const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), 'loops-root-'));

const planOf = (name: string, stages: [number, string, string][]) =>
  parsePlan(
    `# Exemplo\n\n## Fase 1 · F1\n\n${stages.map(([n, title, change]) => `${n}. **${title}** · \`${name}-${change}\``).join('\n')}\n`,
  );

test('nome do loop: kebab-case e único', () => {
  const root = tempRoot();
  assert.equal(validateLoopName('pedidos-cancelamento', root), undefined);
  assert.match(validateLoopName('Pedidos_Cancelamento', root) ?? '', /kebab/);
  fs.mkdirSync(path.join(root, 'openspec/loops/pedidos-cancelamento'), { recursive: true });
  assert.match(validateLoopName('pedidos-cancelamento', root) ?? '', /já existe/);
});

test('lista tolera pasta ausente, JSON inválido e formato desconhecido', () => {
  const root = tempRoot();
  assert.deepEqual(listLoops(root), []);
  saveLoop(loopPaths('bom', root), exampleLoop('bom'));
  fs.mkdirSync(path.join(root, 'openspec/loops/ruim'), { recursive: true });
  fs.writeFileSync(path.join(root, 'openspec/loops/ruim/loop.json'), '{');
  saveLoop(loopPaths('futuro', root), { ...exampleLoop('futuro'), format: 99 });
  const list = Object.fromEntries(listLoops(root).map((item) => [item.name, item]));
  assert.equal(list.bom?.status, 'pending');
  assert.equal(list.ruim?.error, 'loop.json inválido');
  assert.match(list.futuro?.error ?? '', /formato desconhecido/);
});

test('normalizar completa totais e passos ausentes', () => {
  const loop = normalizeLoop({ format: 1, status: 'paused', totals: { cost: 2 } }, 'x');
  assert.equal(loop.name, 'x');
  assert.equal(loop.totals.cost, 2);
  assert.equal(loop.totals.restarts, 0);
  assert.deepEqual(loop.config.steps, DEFAULT_STEPS);
});

test('running sem vigia vivo vale como interrupted', () => {
  assert.equal(effectiveStatus('running', false), 'interrupted');
  assert.equal(effectiveStatus('paused', true), 'running');
  assert.equal(effectiveStatus('paused', false), 'paused');
  assert.equal(effectiveStatus('waiting', false), 'waiting');
});

test('aprovar rascunho congela as etapas e passa a pendente', () => {
  const loop = exampleLoop('web-x', { status: 'draft', stages: [] });
  const result = approvePlan(
    loop,
    planOf('web-x', [
      [1, 'A', '01-a'],
      [2, 'B', '02-b'],
    ]),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.loop?.status, 'pending');
  assert.deepEqual(
    result.loop?.stages.map((s) => [s.number, s.change, s.status]),
    [
      [1, 'web-x-01-a', 'pending'],
      [2, 'web-x-02-b', 'pending'],
    ],
  );
});

test('etapa nova mantém as entregues; renomear entregue é recusado', () => {
  const loop = exampleLoop('web-x', { status: 'paused' });
  loop.stages[0] = { ...stage(loop, 0), status: 'delivered', commit: 'abc', cost: 3 };
  const plan = planOf('web-x', [
    [1, 'A', '01-a'],
    [2, 'B', '02-b'],
    [3, 'C', '03-c'],
  ]);
  assert.deepEqual(planDivergences(loop, plan), ['etapa 3 nova: C (web-x-03-c)']);
  const result = approvePlan(loop, plan);
  assert.equal(result.loop?.stages.length, 3);
  assert.equal(result.loop?.stages[0]?.commit, 'abc');
  assert.equal(result.loop?.status, 'paused');

  const renamed = approvePlan(
    loop,
    planOf('web-x', [
      [1, 'A', '01-outro'],
      [2, 'B', '02-b'],
    ]),
  );
  assert.match(renamed.errors[0] ?? '', /etapa 1 já foi entregue como "web-x-01-a"/);
});

test('plano igual ao aprovado não diverge; campos mudados aparecem em português', () => {
  const loop = exampleLoop('web-x');
  assert.deepEqual(
    planDivergences(
      loop,
      planOf('web-x', [
        [1, 'A', '01-a'],
        [2, 'B', '02-b'],
      ]),
    ),
    [],
  );
  assert.equal(planDivergences(loop, planOf('web-x', [[1, 'A', '01-a']])).length, 1);
  assert.deepEqual(
    planDivergences(
      loop,
      planOf('web-x', [
        [1, 'Outro', '01-a'],
        [2, 'B', '02-b'],
      ]),
    ),
    ['etapa 1 mudou (título): Outro (web-x-01-a)'],
  );
});

test('changes arquivadas viram etapas entregues', () => {
  const root = tempRoot();
  fs.mkdirSync(path.join(root, 'openspec/changes/archive/2026-10-05-web-x-01-a'), { recursive: true });
  const loop = exampleLoop('web-x');
  assert.equal(markArchived(loop, root), 1);
  assert.equal(stage(loop, 0).status, 'delivered');
  assert.equal(stage(loop, 0).deliveredAt, '2026-10-05');
  assert.equal(stage(loop, 1).status, 'pending');
  assert.equal(markArchived(loop, root), 0);
  fs.mkdirSync(path.join(root, 'openspec/changes/archive/2026-10-06-web-x-02-b'), { recursive: true });
  markArchived(loop, root);
  assert.equal(loop.status, 'done');
});

test('trava: ocupada por pid vivo, vencida por pid morto', () => {
  const file = path.join(tempRoot(), '.execucao', 'vigia.lock');
  assert.equal(liveLock(file), null);
  assert.equal(acquireLock(file), null);
  assert.equal(liveLock(file), process.pid);
  assert.equal(acquireLock(file, 999_999_999), process.pid);
  releaseLock(file);
  assert.equal(liveLock(file), null);
  fs.writeFileSync(file, JSON.stringify({ pid: 999_999_999, start: '' }));
  assert.equal(liveLock(file), null);
  assert.equal(acquireLock(file), null);
  assert.equal(liveLock(file), process.pid);
});

test('loop.json sem os totais novos é lido com zero; waiting é um status válido', () => {
  const loop = normalizeLoop({ format: 1, status: 'waiting', totals: { cost: 1, failures: 2 } }, 'x');
  assert.equal(loop.status, 'waiting');
  assert.equal(loop.totals.recoveries, 0);
  assert.equal(loop.totals.recoveriesResolved, 0);
  assert.equal(loop.totals.failures, 2);
});

test('specs para um loop novo indicam as que já são etapa de outro loop', () => {
  const root = tempRoot();
  for (const name of ['web-x-01-a', 'livre']) {
    fs.mkdirSync(path.join(root, 'openspec/changes', name), { recursive: true });
    fs.writeFileSync(path.join(root, 'openspec/changes', name, 'tasks.md'), '- [ ] 1 x\n');
  }
  saveLoop(loopPaths('web-x', root), exampleLoop('web-x'));
  assert.deepEqual(
    specsForNewLoop(root).map((spec) => [spec.name, spec.inLoop]),
    [
      ['livre', undefined],
      ['web-x-01-a', 'web-x'],
    ],
  );
});
