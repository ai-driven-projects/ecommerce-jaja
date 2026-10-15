import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { EXIT } from '../../src/loops/config.js';
import { alignSteps, newIteration } from '../../src/loops/iteration.js';
import { ITERATION_FILE, nodeCommand, tsxLoaders, WATCHER_FILE } from '../../src/loops/node.js';
import { decideAfterExit, restartWait } from '../../src/loops/watcher-rules.js';
import { exampleLoop, stage } from './fixtures.js';

const statusOf = (next: ReturnType<typeof decideAfterExit>) => (next.action === 'stop' ? next.status : next.action);

test('vigia: entregue segue; conclusão, pausa, falha e interrupção param com o status certo', () => {
  assert.deepEqual(decideAfterExit(EXIT.delivered, null, 0, 4), { action: 'next' });
  assert.equal(statusOf(decideAfterExit(EXIT.done, null, 0, 4)), 'done');
  assert.equal(statusOf(decideAfterExit(EXIT.paused, null, 0, 4)), 'paused');
  assert.equal(statusOf(decideAfterExit(EXIT.failed, null, 0, 4)), 'failed');
  assert.equal(statusOf(decideAfterExit(EXIT.interrupted, null, 0, 4)), 'interrupted');
  assert.equal(statusOf(decideAfterExit(null, 'SIGTERM', 0, 4)), 'interrupted');
  assert.deepEqual(decideAfterExit(EXIT.waiting, null, 0, 4), {
    action: 'stop',
    status: 'waiting',
    reason: 'aguardando uma pessoa',
  });
});

test('vigia: crash é recuperado com espera crescente até o limite', () => {
  assert.deepEqual(decideAfterExit(134, null, 0, 4), {
    action: 'recover',
    waitMs: 10_000,
    reason: 'abortado (provável falta de memória)',
  });
  const killed = decideAfterExit(null, 'SIGKILL', 1, 4);
  assert.equal(killed.action === 'recover' && killed.waitMs, 60_000);
  assert.equal(restartWait(10), 300_000);
  assert.equal(statusOf(decideAfterExit(1, null, 4, 4)), 'failed');
});

test('comando do vigia reaproveita só os loaders do tsx e aponta para arquivos que existem', () => {
  const execArgv = [
    '--require',
    '/x/node_modules/tsx/dist/preflight.cjs',
    '--import',
    'file:///x/node_modules/tsx/dist/loader.mjs',
    '--eval',
    'codigo',
    '--test-reporter=spec',
  ];
  assert.deepEqual(tsxLoaders(execArgv), execArgv.slice(0, 4));
  // `tsx` sem caminho vira a URL do pacote: o filho roda em outra pasta
  const [flag, loader] = tsxLoaders(['--import', 'tsx', '--test']);
  assert.equal(flag, '--import');
  assert.match(loader ?? '', /^file:\/\/.+tsx/);
  const { command, args } = nodeCommand(WATCHER_FILE, ['m'], execArgv);
  assert.equal(command, process.execPath);
  assert.deepEqual(args.slice(-2), [WATCHER_FILE, 'm']);
  const withoutTsx = nodeCommand(ITERATION_FILE, ['m'], []);
  assert.ok(withoutTsx.command === 'tsx' || fs.existsSync(withoutTsx.command));
  assert.ok(fs.existsSync(WATCHER_FILE) && fs.existsSync(ITERATION_FILE));
  // no binário compilado o arquivo é .js e roda direto no node
  assert.deepEqual(nodeCommand('/x/dist/loops/watcher.js', ['m'], []), {
    command: process.execPath,
    args: ['/x/dist/loops/watcher.js', 'm'],
  });
});

test('iteração nova começa no primeiro passo; retomada começa no primeiro não concluído', () => {
  const loop = exampleLoop();
  loop.totals.iterationsStarted = 2;
  const iteration = newIteration(
    loop,
    stage(loop, 1),
    'abc',
    ['briefing', 'propose', 'apply'],
    new Date('2026-10-05T00:00:00Z'),
  );
  assert.deepEqual([iteration.number, iteration.stage, iteration.currentStep, iteration.steps.length], [3, 2, 0, 3]);
  const [first, second] = iteration.steps;
  if (!first || !second) throw new Error('passos ausentes');
  first.state = 'ok';
  second.state = 'running';
  const resumed = alignSteps(iteration, ['briefing', 'propose', 'apply']);
  assert.equal(resumed.currentStep, 1);
  assert.equal(resumed.steps[1]?.state, 'pending');
  const withNewStep = alignSteps(
    { ...resumed, steps: resumed.steps.map((step) => ({ ...step, state: 'ok' as const })) },
    ['briefing', 'propose', 'apply', 'archive'],
  );
  assert.equal(withNewStep.currentStep, 3);
});
