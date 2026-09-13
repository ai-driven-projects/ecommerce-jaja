import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseArgs } from './args.js';

describe('parseArgs', () => {
  it('sem argumentos abre a paleta', () => {
    assert.deepEqual(parseArgs([]), {
      commandId: null,
      yes: false,
      dryRun: false,
      all: false,
      pending: false,
      help: false,
      list: false,
      version: false,
      options: {},
      unknown: [],
    });
  });

  it('lê o comando e as flags', () => {
    const args = parseArgs(['doctor', '--yes', '--dry-run']);
    assert.equal(args.commandId, 'doctor');
    assert.equal(args.yes, true);
    assert.equal(args.dryRun, true);
  });

  it('lê --steps nas duas formas e --all', () => {
    assert.deepEqual(parseArgs(['setup', '--steps', 'install, build']).steps, ['install', 'build']);
    assert.deepEqual(parseArgs(['setup', '--steps=env']).steps, ['env']);
    assert.equal(parseArgs(['setup', '--all']).all, true);
    assert.equal(parseArgs(['setup']).steps, undefined);
  });

  it('acumula argumentos posicionais desconhecidos', () => {
    const args = parseArgs(['doctor', 'extra', '-x']);
    assert.deepEqual(args.unknown, ['extra', '-x']);
  });

  it('lê opções livres nas formas --nome=valor, --nome valor e --nome', () => {
    const args = parseArgs(['scrape:products', '--categorias=escolar,informatica', '--produtos', '50-100', '--sem-detalhes', '--yes']);
    assert.deepEqual(args.options, { categorias: 'escolar,informatica', produtos: '50-100', 'sem-detalhes': 'true' });
    assert.equal(args.yes, true);
    assert.deepEqual(args.unknown, []);
  });
});
