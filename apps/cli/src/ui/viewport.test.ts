import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Command } from '../core/command.js';
import { computeViewport } from './viewport.js';

const cmd = (id: string, group = 'G'): Command => ({ id, title: id, description: '', group, run: async () => ({ status: 'ok', summary: '' }) });
const list = Array.from({ length: 10 }, (_, i) => cmd(`c${i}`));

describe('computeViewport', () => {
  it('lista vazia devolve janela vazia', () => {
    assert.deepEqual(computeViewport([], 0, 0, 5), { start: 0, end: 0 });
  });

  it('mantém o cursor dentro da janela ao descer', () => {
    const view = computeViewport(list, 0, 7, 5);
    assert.ok(view.start <= 7 && 7 < view.end);
  });

  it('volta a janela quando o cursor sobe acima dela', () => {
    assert.equal(computeViewport(list, 5, 2, 5).start, 2);
  });
});
