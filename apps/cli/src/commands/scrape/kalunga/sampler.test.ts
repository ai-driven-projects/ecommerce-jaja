import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseRange, planSampling, spreadIndexes, takeRound } from './sampler.js';
import type { KalungaGroup, ListedProduct } from './types.js';

const group = (id: number, highlighted = false): KalungaGroup => ({ id, departmentId: 2, departmentSlug: 'escolar', slug: `g${id}`, name: `G${id}`, url: '', highlighted });
const product = (id: string): ListedProduct => ({ id, slug: id, url: '', name: id, image: null, price: null, listPrice: null, rating: null });

describe('parseRange', () => {
  it('aceita ids conhecidos, intervalos e números', () => {
    assert.equal(parseRange('50-100')?.max, 100);
    assert.deepEqual(parseRange('30-40'), { id: '30-40', label: 'De 30 a 40 produtos', min: 30, max: 40 });
    assert.deepEqual(parseRange('80'), { id: '80', label: '80 produtos', min: 80, max: 80 });
    assert.equal(parseRange('muitos'), null);
    assert.equal(parseRange('90-10'), null);
  });
});

describe('spreadIndexes', () => {
  it('espalha os índices pela lista inteira', () => {
    assert.deepEqual(spreadIndexes(10, 2), [2, 7]);
    assert.deepEqual(spreadIndexes(3, 5), [0, 1, 2]);
    assert.deepEqual(spreadIndexes(0, 3), []);
  });
});

describe('planSampling', () => {
  it('amostra grupos suficientes para o alvo, destaques primeiro, e guarda o resto como reserva', () => {
    const groups = [group(1), group(2), group(3, true), group(4), group(5), group(6)];
    const plan = planSampling(groups, 10, 5);
    assert.equal(plan.sampledGroups, 2);
    assert.equal(plan.groups.length, 6);
    assert.equal(plan.groups[0]?.id, 3);
    assert.deepEqual(new Set(plan.groups.map((item) => item.id)), new Set([1, 2, 3, 4, 5, 6]));
  });
});

describe('takeRound', () => {
  it('respeita o limite por grupo, o alvo e não repete produtos', () => {
    const collected = new Map<string, ListedProduct>();
    assert.equal(takeRound(collected, [product('a'), product('b'), product('c')], 2, 10).length, 2);
    assert.equal(takeRound(collected, [product('a'), product('c'), product('d')], 5, 3).length, 1);
    assert.deepEqual([...collected.keys()], ['a', 'b', 'c']);
  });
});
