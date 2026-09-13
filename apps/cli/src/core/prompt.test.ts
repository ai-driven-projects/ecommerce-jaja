import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePickAnswer, parseYesNo } from './prompt.js';

describe('parseYesNo', () => {
  it('aceita respostas em português e inglês', () => {
    assert.equal(parseYesNo('s', false), true);
    assert.equal(parseYesNo('Sim', false), true);
    assert.equal(parseYesNo('yes', false), true);
    assert.equal(parseYesNo('n', true), false);
    assert.equal(parseYesNo('não', true), false);
  });

  it('usa o padrão para vazio ou desconhecido', () => {
    assert.equal(parseYesNo('', true), true);
    assert.equal(parseYesNo('talvez', false), false);
  });
});

describe('parsePickAnswer', () => {
  const options = [
    { id: 'escolar', label: 'Escolar' },
    { id: 'informatica', label: 'Informática' },
    { id: 'gamers', label: 'Gamers' },
  ];

  it('aceita números, ids e * e devolve na ordem da lista', () => {
    assert.deepEqual(parsePickAnswer('3, 1', options, [], true), ['escolar', 'gamers']);
    assert.deepEqual(parsePickAnswer('informatica gamers', options, [], true), ['informatica', 'gamers']);
    assert.deepEqual(parsePickAnswer('*', options, [], true), ['escolar', 'informatica', 'gamers']);
  });

  it('vazio devolve o padrão e ignora desconhecidos', () => {
    assert.deepEqual(parsePickAnswer('', options, ['gamers'], true), ['gamers']);
    assert.deepEqual(parsePickAnswer('9, nada', options, ['gamers'], true), []);
  });

  it('escolha única fica com a primeira', () => {
    assert.deepEqual(parsePickAnswer('2,3', options, [], false), ['informatica']);
  });
});
