import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { JourneyStep } from './command.js';
import { expandSelection, pendingIds, toggleMany } from './journey.js';

const step = (id: string, area?: string, publish = false): JourneyStep => ({
  id,
  label: id,
  area,
  publish,
  defaultSelected: false,
  run: async () => ({ status: 'ok', summary: '' }),
  detect: async () => ({ status: 'pending' }),
});

const steps = [step('tools', 'prep'), step('config', 'prep'), step('migrate', 'db', true), step('backend', 'backend', true)];

describe('expandSelection', () => {
  it('expande áreas, @publish e @pending', () => {
    assert.deepEqual(expandSelection(steps, ['@prep']), ['tools', 'config']);
    assert.deepEqual(expandSelection(steps, ['@publish']), ['migrate', 'backend']);
    const detections = new Map([['tools', { status: 'done' as const }]]);
    assert.deepEqual(expandSelection(steps, ['@pending'], detections), ['config', 'migrate', 'backend']);
  });

  it('mantém ids desconhecidos para o chamador reportar', () => {
    assert.deepEqual(expandSelection(steps, ['nope', 'tools']), ['nope', 'tools']);
  });
});

describe('pendingIds', () => {
  it('sem detecção considera tudo pendente', () => {
    assert.deepEqual(pendingIds(steps), ['tools', 'config', 'migrate', 'backend']);
  });
});

describe('toggleMany', () => {
  it('marca quando falta algum e desmarca quando todos estão marcados', () => {
    const marked = toggleMany(new Set(['a']), ['a', 'b']);
    assert.deepEqual([...marked].sort(), ['a', 'b']);
    assert.deepEqual([...toggleMany(marked, ['a', 'b'])], []);
  });
});
