import assert from 'node:assert/strict';
import { test } from 'node:test';
import { longDuration, money } from '../../src/loops/format.js';
import type { LoopListItem } from '../../src/loops/loops.js';
import {
  failuresFromEvents,
  iterationProgress,
  liveTime,
  logLines,
  parseEvents,
  phaseSummary,
  recoveryMark,
  scrollWindow,
  sidebarLines,
  sortLoops,
  stageSituation,
  statusActions,
  stepAverages,
  when,
} from '../../src/loops/presentation.js';
import { exampleLoop, stage } from './fixtures.js';

const item = (name: string, status?: LoopListItem['status']): LoopListItem => ({
  name,
  status,
  watcher: null,
  paths: {} as LoopListItem['paths'],
});

test('lista: executando primeiro, concluídos e pastas com erro por último', () => {
  const order = sortLoops([
    item('c', 'done'),
    item('erro'),
    item('b', 'pending'),
    item('a', 'running'),
    item('d', 'failed'),
    item('e', 'draft'),
    item('f', 'waiting'),
  ]);
  assert.deepEqual(
    order.map((i) => i.name),
    ['a', 'f', 'd', 'b', 'e', 'c', 'erro'],
  );
});

test('totais formatados como na barra superior', () => {
  assert.equal(longDuration(83 * 60_000), '1h23min');
  assert.equal(longDuration(23 * 60_000), '23min');
  assert.equal(longDuration(45_000), '45s');
  assert.equal(money(5.5), 'US$ 5,50');
});

test('tempo ao vivo só cresce com o vigia vivo', () => {
  assert.equal(liveTime(1000, 5000, true, 7000), 3000);
  assert.equal(liveTime(1000, 5000, false, 7000), 1000);
  assert.equal(liveTime(1000, undefined, true, 7000), 1000);
});

test('janela da lateral acompanha o foco sem passar das pontas', () => {
  assert.deepEqual(scrollWindow(10, 3, 20), { start: 0, end: 10 });
  assert.deepEqual(scrollWindow(30, 15, 10), { start: 10, end: 20 });
  assert.deepEqual(scrollWindow(30, 1, 10), { start: 0, end: 10 });
  assert.deepEqual(scrollWindow(30, 29, 10), { start: 20, end: 30 });
});

test('lateral: fases com progresso, etapa em andamento em foco e falha marcada', () => {
  const loop = exampleLoop();
  loop.stages.push({ number: 3, phase: 'F2', title: 'C', change: 'web-x-03-c', status: 'pending' });
  stage(loop, 0).status = 'delivered';
  loop.iteration = { number: 2, stage: 2, startCommit: '', startedAt: '', currentStep: 4, steps: [] };
  const { lines, focus } = sidebarLines(loop, 'running');
  assert.deepEqual(
    lines.map((line) =>
      line.kind === 'phase'
        ? `# ${line.name} ${line.delivered}/${line.total}`
        : `${line.stage.number} ${line.situation}`,
    ),
    ['# F1 1/2', '1 delivered', '2 inProgress', '# F2 0/1', '3 pending'],
  );
  assert.equal(focus, 2);
  assert.equal(stageSituation(loop, stage(loop, 1), 'failed'), 'failed');
  assert.equal(phaseSummary(loop.stages), 'F1 1/2 · F2 0/1');
});

test('progresso da iteração conta passos ok e pulados', () => {
  const step = (state: 'ok' | 'skipped' | 'running') => ({ id: 'x', state, durationMs: 0, cost: 0, attempts: 1 });
  assert.deepEqual(
    iterationProgress({
      number: 1,
      stage: 1,
      startCommit: '',
      startedAt: '',
      currentStep: 2,
      steps: [step('ok'), step('skipped'), step('running')],
    }),
    { done: 2, total: 3 },
  );
});

test('quando, em português', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  assert.equal(when('2026-10-05T11:59:30Z', now), 'agora');
  assert.equal(when('2026-10-05T11:55:00Z', now), 'há 5 min');
  assert.equal(when('2026-10-05T09:00:00Z', now), 'há 3 h');
  assert.equal(when('2026-10-04T10:00:00Z', now), 'ontem');
  assert.equal(when(undefined, now), 'nunca');
});

test('médias por passo das etapas entregues', () => {
  const loop = exampleLoop();
  stage(loop, 0).steps = [{ id: 'apply', durationMs: 1000, cost: 1, attempts: 1 }];
  stage(loop, 1).steps = [{ id: 'apply', durationMs: 3000, cost: 2, attempts: 2 }];
  assert.deepEqual(stepAverages(loop.stages), [
    { id: 'apply', label: 'Aplicar a spec', averageMs: 2000, averageCost: 1.5, samples: 2 },
  ]);
});

test('log filtrado e falhas a partir dos eventos', () => {
  const events = parseEvents([
    JSON.stringify({ ts: '2026-10-05T12:00:00Z', type: 'log', level: 'info', text: 'começou' }),
    JSON.stringify({ ts: '2026-10-05T12:00:01Z', type: 'log', level: 'output', text: 'linha do build' }),
    JSON.stringify({ ts: '2026-10-05T12:00:02Z', type: 'log', level: 'command', text: 'npm test' }),
    'quebrado',
    JSON.stringify({ ts: '2026-10-05T12:00:03Z', type: 'failure', step: 'apply', error: 'boom', report: 'r.md' }),
  ]);
  assert.equal(logLines(events, 'all').length, 3);
  assert.equal(logLines(events, 'noOutput').length, 2);
  assert.equal(logLines(events, 'main').length, 1);
  assert.match(logLines(events, 'main')[0] ?? '', /info {4}começou$/);
  assert.deepEqual(failuresFromEvents(events), [
    { ts: '2026-10-05T12:00:03Z', step: 'apply', error: 'boom', report: 'r.md' },
  ]);
});

test('ações por status', () => {
  const keys = (status: Parameters<typeof statusActions>[0], divergent = false, pauseRequested = false) =>
    statusActions(status, { divergent, pauseRequested }).map((action) => action.key);
  assert.deepEqual(keys('draft'), ['a', 'e', 'D']);
  assert.deepEqual(keys('pending'), ['i']);
  assert.deepEqual(keys('failed'), ['i']);
  assert.deepEqual(keys('waiting'), ['i']);
  assert.deepEqual(keys('paused', true), ['a', 'e']);
  assert.deepEqual(keys('running'), ['p', 'x']);
  assert.equal(statusActions('running', { divergent: false, pauseRequested: true })[0]?.label, 'cancelar a pausa');
  assert.deepEqual(keys('done'), []);
});

test('marcador de recuperação', () => {
  assert.equal(recoveryMark({}), undefined);
  assert.deepEqual(recoveryMark({ recoveries: [{ resolved: false }, { resolved: true }] }), {
    text: '↻2',
    resolved: true,
  });
});
