import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Command } from './command.js';
import { createRegistry, filterCommands, scoreCommand } from './registry.js';

const make = (id: string, title: string, extra: Partial<Command> = {}): Command => ({
  id,
  title,
  description: '',
  group: 'Projeto',
  run: async () => ({ status: 'ok', summary: '' }),
  ...extra,
});

const doctor = make('doctor', 'Doctor', {
  description: 'Verifica o ambiente de desenvolvimento',
  keywords: ['diagnostico', 'ambiente'],
});
const clean = make('clean', 'Limpar projeto', { description: 'Remove node_modules e builds' });
const dbStart = make('db:start', 'Subir banco local', { keywords: ['postgres', 'docker'] });

describe('filterCommands', () => {
  it('devolve tudo na ordem original com busca vazia', () => {
    assert.deepEqual(filterCommands([doctor, clean, dbStart], '').map((c) => c.id), ['doctor', 'clean', 'db:start']);
  });

  it('prioriza id exato sobre correspondência parcial', () => {
    const result = filterCommands([clean, doctor, dbStart], 'doctor');
    assert.equal(result[0]?.id, 'doctor');
  });

  it('ignora acentos e caixa', () => {
    assert.ok(scoreCommand(doctor, 'DIAGNÓSTICO') > 0);
    assert.ok(scoreCommand(clean, 'LIMPAR') > 0);
  });

  it('encontra por palavra-chave e descrição', () => {
    assert.deepEqual(filterCommands([doctor, clean, dbStart], 'postgres').map((c) => c.id), ['db:start']);
    assert.deepEqual(filterCommands([doctor, clean, dbStart], 'node_modules').map((c) => c.id), ['clean']);
  });

  it('aceita várias palavras em ordem livre', () => {
    assert.deepEqual(filterCommands([doctor, clean, dbStart], 'local banco').map((c) => c.id), ['db:start']);
  });

  it('não devolve comandos sem correspondência', () => {
    assert.deepEqual(filterCommands([doctor, clean, dbStart], 'deploy'), []);
  });
});

describe('createRegistry', () => {
  it('rejeita ids duplicados, inclusive aninhados', () => {
    assert.throws(() => createRegistry([doctor, make('db', 'Banco', { children: [make('doctor', 'Outro')] })]), /duplicado/);
  });

  it('localiza por id em qualquer nível e mantém a trilha', () => {
    const db = make('db', 'Banco', { children: [dbStart] });
    const registry = createRegistry([doctor, db]);
    assert.equal(registry.find('db:start')?.title, 'Subir banco local');
    assert.equal(registry.find('nope'), undefined);
    assert.deepEqual(registry.roots().map((c) => c.id), ['doctor', 'db']);
    const entry = registry.filter('postgres')[0];
    assert.equal(entry?.command.id, 'db:start');
    assert.deepEqual(entry?.breadcrumb.map((c) => c.id), ['db']);
  });
});
