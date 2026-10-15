import { DEFAULT_STEPS } from '../../src/loops/config.js';
import { zeroTotals } from '../../src/loops/loops.js';
import type { Loop } from '../../src/loops/types.js';

/** Loop mínimo para os testes do motor. */
export function exampleLoop(name = 'web-x', extras: Partial<Loop> = {}): Loop {
  return {
    format: 1,
    name,
    title: 'Exemplo',
    createdAt: '2026-10-05T00:00:00.000Z',
    status: 'pending',
    config: {
      scope: ['apps/web'],
      commitPrefix: 'feat(web)',
      requiredCommands: [],
      checks: [],
      forbiddenTools: [],
      steps: [...DEFAULT_STEPS],
      limits: {},
    },
    stages: [
      { number: 1, phase: 'F1', title: 'A', change: `${name}-01-a`, status: 'pending' },
      { number: 2, phase: 'F1', title: 'B', change: `${name}-02-b`, status: 'pending' },
    ],
    iteration: null,
    totals: zeroTotals(),
    ...extras,
  };
}

export function stage(loop: Loop, index: number) {
  const found = loop.stages[index];
  if (!found) throw new Error(`etapa ${index} ausente`);
  return found;
}
