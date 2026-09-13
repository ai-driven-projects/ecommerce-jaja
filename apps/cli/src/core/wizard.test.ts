import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CommandContext, LogEntry, WizardStep } from './command.js';
import { createReport } from './reporter.js';
import { defaultSelection, resolveSelection, runSteps } from './wizard.js';

const step = (id: string, extra: Partial<WizardStep> = {}): WizardStep => ({
  id,
  label: id.toUpperCase(),
  defaultSelected: true,
  run: async () => ({ status: 'ok', summary: `${id} ok` }),
  ...extra,
});

function ctxWith(entries: LogEntry[], signal = new AbortController().signal): CommandContext {
  return {
    project: { rootDir: '/tmp', name: 'x', backendDir: null, frontendDir: null },
    yes: true,
    dryRun: false,
    report: createReport({ log: (entry) => entries.push(entry) }),
    exec: async () => ({ ok: true, code: 0, stdout: '', stderr: '', notFound: false, timedOut: false }),
    confirm: async (_q, d = true) => d,
    ask: async (_q, d) => d,
    pick: async (_q, _o, c) => c?.defaults ?? [],
    options: {},
    signal,
  };
}

describe('resolveSelection', () => {
  const steps = [step('env'), step('db'), step('install'), step('generate', { requires: ['install'] }), step('migrate', { requires: ['db', 'generate'] })];

  it('inclui dependências transitivas mantendo a ordem do wizard', () => {
    const { steps: chosen, added } = resolveSelection(steps, ['migrate']);
    assert.deepEqual(chosen.map((s) => s.id), ['db', 'install', 'generate', 'migrate']);
    assert.deepEqual(added.sort(), ['db', 'generate', 'install']);
  });

  it('não marca como adicionada uma dependência já escolhida', () => {
    const { added } = resolveSelection(steps, ['install', 'generate']);
    assert.deepEqual(added, []);
  });

  it('padrões respeitam defaultSelected', () => {
    assert.deepEqual(defaultSelection([step('a'), step('b', { defaultSelected: false })]), ['a']);
  });
});

describe('runSteps', () => {
  it('emite eventos e para na primeira falha', async () => {
    const entries: LogEntry[] = [];
    const result = await runSteps(ctxWith(entries), [
      step('a'),
      step('b', { run: async () => ({ status: 'error', summary: 'quebrou' }) }),
      step('c'),
    ]);
    assert.equal(result.status, 'error');
    const statuses = entries.filter((e) => e.level === 'step').map((e) => `${e.step?.id}:${e.step?.status}`);
    assert.deepEqual(statuses, ['a:pending', 'b:pending', 'c:pending', 'a:running', 'a:ok', 'b:running', 'b:error', 'c:skipped']);
  });

  it('continua após falha quando continueOnError', async () => {
    const entries: LogEntry[] = [];
    const result = await runSteps(ctxWith(entries), [
      step('a', { continueOnError: true, run: async () => ({ status: 'error', summary: 'x' }) }),
      step('b'),
    ]);
    assert.equal(result.status, 'error');
    assert.ok(entries.some((e) => e.step?.id === 'b' && e.step.status === 'ok'));
  });

  it('transforma exceções em falha da etapa', async () => {
    const entries: LogEntry[] = [];
    const result = await runSteps(ctxWith(entries), [
      step('a', {
        run: async () => {
          throw new Error('boom');
        },
      }),
    ]);
    assert.equal(result.status, 'error');
    assert.match(result.summary, /A/);
    assert.ok(entries.some((e) => e.level === 'error' && e.message === 'boom'));
  });
});
