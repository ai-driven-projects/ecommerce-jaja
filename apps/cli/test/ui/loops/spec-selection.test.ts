import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterSpecs, toggleInOrder } from '../../../src/ui/loops/spec-selection.js';
import { appendPasted, applyMultilineTyping, applyTyping } from '../../../src/ui/loops/typing.js';

test('marcar põe no fim da ordem; desmarcar tira e renumera as seguintes', () => {
  let order = toggleInOrder([], 'a');
  order = toggleInOrder(order, 'b');
  order = toggleInOrder(order, 'c');
  assert.deepEqual(order, ['a', 'b', 'c']);
  assert.deepEqual(toggleInOrder(order, 'a'), ['b', 'c']);
});

test('filtro por palavras no nome ou no resumo, sem diferenciar maiúsculas', () => {
  const specs = [
    { name: 'usuarios-na-raiz', summary: 'Move os usuários para a raiz' },
    { name: 'busca-v2', summary: 'Busca nova no web' },
  ];
  assert.equal(filterSpecs(specs, '').length, 2);
  assert.deepEqual(
    filterSpecs(specs, 'BUSCA').map((spec) => spec.name),
    ['busca-v2'],
  );
  assert.deepEqual(
    filterSpecs(specs, 'raiz move').map((spec) => spec.name),
    ['usuarios-na-raiz'],
  );
  assert.deepEqual(filterSpecs(specs, 'raiz web'), []);
});

test('digitação: bloco de teclas, backspace e teclas de navegação', () => {
  assert.equal(applyTyping('ab', 'cd', {}), 'abcd');
  assert.equal(applyTyping('abc', '', { backspace: true }), 'ab');
  assert.equal(applyTyping('ab', 'x\x7f', {}), 'ab');
  assert.equal(applyTyping('ab', '', { upArrow: true }), 'ab');
  assert.equal(applyTyping('ab', 'd', { ctrl: true }), 'ab');
  assert.equal(applyMultilineTyping('a', '', { return: true }), 'a\n');
  assert.equal(appendPasted('a', 'b\r\nc\td'), 'ab\nc  d');
});
