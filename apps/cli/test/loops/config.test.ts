import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_LIMITS, DEFAULT_STEPS, effectiveConfig } from '../../src/loops/config.js';

const base = {
  scope: [],
  commitPrefix: 'feat',
  requiredCommands: [],
  checks: [],
  forbiddenTools: [],
  steps: DEFAULT_STEPS,
};

test('limites ausentes ficam com o padrão', () => {
  assert.deepEqual(effectiveConfig({ ...base, limits: {} }).limits, DEFAULT_LIMITS);
});

test('limites do loop sobrescrevem só o que trazem', () => {
  const limits = effectiveConfig({ ...base, limits: { fixes: 5, sessionMin: 30 } }).limits;
  assert.equal(limits.fixes, 5);
  assert.equal(limits.sessionMin, 30);
  assert.equal(limits.tasksPerSession, DEFAULT_LIMITS.tasksPerSession);
});

test('limites inválidos ficam com o padrão', () => {
  const limits = effectiveConfig({
    ...base,
    limits: { fixes: 0, continuations: -1, restarts: 'x' as unknown as number },
  }).limits;
  assert.equal(limits.fixes, DEFAULT_LIMITS.fixes);
  assert.equal(limits.continuations, DEFAULT_LIMITS.continuations);
  assert.equal(limits.restarts, DEFAULT_LIMITS.restarts);
});

test('sessão parada cai em 10 min, bem antes do limite de 60 min da sessão', () => {
  const limits = effectiveConfig({ ...base, limits: {} }).limits;
  assert.deepEqual([limits.sessionIdleMin, limits.sessionMin], [10, 60]);
});

test('padrões da recuperação: 3 execuções por passo e 5 recuperações por iteração', () => {
  const limits = effectiveConfig({ ...base, limits: {} }).limits;
  assert.equal(limits.attemptsPerStep, 3);
  assert.equal(limits.recoveriesPerIteration, 5);
});
