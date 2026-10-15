import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { runChecks } from '../../src/loops/checks.js';
import { readJson, readTail } from '../../src/loops/files.js';
import { loopPaths, saveLoop } from '../../src/loops/loops.js';
import { MAX_ACTIVITIES, Monitor } from '../../src/loops/monitor.js';
import type { Live, Loop } from '../../src/loops/types.js';
import { exampleLoop } from './fixtures.js';

function setup(intervalMs = 30) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-mon-'));
  const paths = loopPaths('web-x', root);
  const state = { loop: exampleLoop('web-x') };
  state.loop.iteration = {
    number: 1,
    stage: 1,
    startCommit: 'abc',
    startedAt: '',
    currentStep: 0,
    steps: [{ id: 'propose', state: 'running', durationMs: 0, cost: 0, attempts: 1 }],
  };
  const monitor = new Monitor(paths, state, () => saveLoop(paths, state.loop), intervalMs);
  return { root, paths, state, monitor };
}

test('agora.json é gravado com atraso e junta várias mudanças numa gravação', async () => {
  const { paths, monitor } = setup(50);
  for (let i = 0; i < 100; i++) monitor.activity({ ts: i, kind: 'text', text: `a${i}` });
  assert.equal(fs.existsSync(paths.live), false);
  await new Promise((resolve) => setTimeout(resolve, 120));
  const read = readJson<Live>(paths.live);
  assert.ok(read.ok);
  assert.equal(read.ok && read.value.activities.length, MAX_ACTIVITIES);
  assert.equal(read.ok && read.value.activities.at(-1)?.text, 'a99');
});

test('sessões somam custo, turnos e sessões no loop e no passo', () => {
  const { paths, state, monitor } = setup();
  const session = { label: 'propor', attempt: 1, ok: true, cost: 0.8, turns: 10, durationMs: 1000, file: 'x', end: 0 };
  monitor.recordSession(session);
  monitor.recordSession({ ...session, ok: false, cost: 0.6, turns: 4, error: 'boom' });
  const totals = state.loop.totals;
  assert.equal(Math.round(totals.cost * 100), 140);
  assert.equal(totals.turns, 14);
  assert.equal(totals.claudeSessions, 2);
  assert.equal(Math.round((state.loop.iteration?.steps[0]?.cost ?? 0) * 100), 140);
  const saved = readJson<Loop>(paths.loop);
  assert.ok(saved.ok && Math.round(saved.value.totals.cost * 100) === 140);
  const events = readTail(paths.events).map((line) => JSON.parse(line) as { type: string; step?: string });
  assert.equal(events.filter((event) => event.type === 'claude_session').length, 2);
  assert.equal(events[0]?.step, 'propose');
  monitor.close();
});

test('tempo é somado ao loop e ao passo a cada contagem', async () => {
  const { state, monitor } = setup();
  monitor.startClock(40);
  await new Promise((resolve) => setTimeout(resolve, 130));
  monitor.accountTime();
  monitor.close();
  const ms = state.loop.totals.durationMs;
  // o limite de cima é folgado: a suíte roda em paralelo e o relógio atrasa sob carga
  assert.ok(ms >= 120 && ms < 2000, `tempo ${ms}`);
  assert.equal(state.loop.iteration?.steps[0]?.durationMs, ms);
});

test('verificações rodam em ordem, param na primeira falha e contam no total', async () => {
  const { root, state, monitor } = setup();
  const node = (code: number) => ['node', '-e', `console.log('saida ${code}'); process.exit(${code})`];
  const checks = [
    { id: 'a', label: 'passa', command: node(0), dir: '.' },
    { id: 'b', label: 'falha', command: node(3), dir: '.' },
    { id: 'c', label: 'nao roda', command: node(0), dir: '.' },
  ];
  const failure = await runChecks(checks, {
    root,
    dir: path.join(root, 'it'),
    round: '1ª',
    timeoutMs: 10_000,
    monitor,
  });
  assert.equal(failure?.label, 'falha');
  assert.deepEqual(failure?.tail, ['saida 3']);
  assert.equal(state.loop.totals.checks, 2);
  assert.deepEqual(
    monitor.live.items.map((item) => item.state),
    ['ok', 'failed', 'skipped'],
  );
  assert.equal(
    await runChecks(checks.slice(0, 1), { root, dir: path.join(root, 'it'), round: '2ª', timeoutMs: 10_000, monitor }),
    null,
  );
  monitor.close();
});
