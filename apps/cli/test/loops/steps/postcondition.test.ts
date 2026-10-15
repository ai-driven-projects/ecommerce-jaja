import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { effectiveConfig } from '../../../src/loops/config.js';
import { loopPaths } from '../../../src/loops/loops.js';
import { Monitor } from '../../../src/loops/monitor.js';
import type { IterationContext } from '../../../src/loops/steps/context.js';
import { STEPS } from '../../../src/loops/steps/registry.js';
import type { Loop } from '../../../src/loops/types.js';
import { exampleLoop, stage } from '../fixtures.js';

/** Um repositório git com o loop web-x numa iteração da etapa 1. */
function setup(extras: Partial<Loop> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-post-'));
  const g = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'apps/web'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/web/a.ts'), 'a');
  g('add', '.');
  g('commit', '-qm', 'base');
  const loop = exampleLoop('web-x', extras);
  loop.iteration = { number: 1, stage: 1, startCommit: '', startedAt: '', currentStep: 0, steps: [] };
  const state = { loop };
  const paths = loopPaths('web-x', root);
  const ctx = {
    paths,
    state,
    config: effectiveConfig(loop.config),
    stage: stage(loop, 0),
    dir: path.join(paths.run, 'iteracao-01'),
    monitor: new Monitor(paths, state, () => {}),
    signal: new AbortController().signal,
  } as unknown as IterationContext;
  const write = (relative: string, text = 'x') => {
    fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    fs.writeFileSync(path.join(root, relative), text);
  };
  return { root, ctx, loop, g, write };
}

test('briefing: cumprida com descrição', async () => {
  const { ctx, loop } = setup();
  assert.deepEqual(await STEPS.briefing.postcondition(ctx), ['a iteração não tem briefing']);
  if (loop.iteration) loop.iteration.briefing = { title: 't', comparison: '', description: 'd' };
  assert.deepEqual(await STEPS.briefing.postcondition(ctx), []);
});

test('apply: sem tasks.md, com tarefa aberta e com tudo feito', async () => {
  const { ctx, write } = setup();
  assert.deepEqual(await STEPS.apply.postcondition(ctx), ['tasks.md não existe']);
  write('openspec/changes/web-x-01-a/tasks.md', '## 1\n- [x] 1.1 a\n- [ ] 1.2 b\n');
  assert.deepEqual(await STEPS.apply.postcondition(ctx), ['1 tarefa(s) abertas: 1.2 b']);
  write('openspec/changes/web-x-01-a/tasks.md', '## 1\n- [x] 1.1 a\n- [x] 1.2 b\n');
  assert.deepEqual(await STEPS.apply.postcondition(ctx), []);
});

test('archive: precisa estar no archive e fora de changes', async () => {
  const { root, ctx, write } = setup();
  write('openspec/changes/web-x-01-a/tasks.md');
  assert.equal((await STEPS.archive.postcondition(ctx)).length, 2);
  write('openspec/changes/archive/2026-10-05-web-x-01-a/tasks.md');
  assert.deepEqual(await STEPS.archive.postcondition(ctx), ['a change ainda existe em openspec/changes/']);
  fs.rmSync(path.join(root, 'openspec/changes/web-x-01-a'), { recursive: true });
  assert.deepEqual(await STEPS.archive.postcondition(ctx), []);
});

test('verificações: sem verificações é cumprida; com verificação que falha não', async () => {
  const { ctx } = setup();
  assert.deepEqual(await STEPS.verifyChange.postcondition(ctx), []);
  ctx.config.checks = [{ id: 'f', label: 'falha', command: ['node', '-e', 'process.exit(1)'], dir: '.' }];
  assert.equal((await STEPS.baseline.postcondition(ctx)).length, 1);
  ctx.monitor.close();
});

test('commits: change e escopo limpos, etapa entregue', async () => {
  const { ctx, loop, write, g } = setup();
  write('openspec/changes/web-x-01-a/proposal.md');
  assert.equal((await STEPS.commitProposal.postcondition(ctx)).length, 1);
  g('add', '.');
  g('commit', '-qm', 'proposta');
  assert.deepEqual(await STEPS.commitProposal.postcondition(ctx), []);

  write('apps/web/a.ts', 'mudou');
  assert.deepEqual(await STEPS.commitDelivery.postcondition(ctx), [
    'a etapa ainda não está entregue no loop.json',
    'alterações não commitadas no escopo:  M apps/web/a.ts',
  ]);
  stage(loop, 0).status = 'delivered';
  g('add', '.');
  g('commit', '-qm', 'entrega');
  assert.deepEqual(await STEPS.commitDelivery.postcondition(ctx), []);
});
