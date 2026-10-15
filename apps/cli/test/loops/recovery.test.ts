import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { disablements, snapshot } from '../../src/loops/guard.js';
import { buildPrompt } from '../../src/loops/prompts.js';
import { classifyError, defaultWhatToDo, errorSignature } from '../../src/loops/recovery.js';
import { NeedsHuman, StepFailure } from '../../src/loops/steps/context.js';

test('classificação: humano, motor e recuperável', () => {
  assert.equal(classifyError(new NeedsHuman('escopo sujo', 'commite')), 'human');
  assert.equal(
    classifyError(new StepFailure('sessão do Claude (propor) falhou: Invalid API key · Please run /login')),
    'human',
  );
  assert.equal(
    classifyError(new StepFailure('git commit falhou', { tail: ['git@github.com: Permission denied (publickey).'] })),
    'human',
  );
  assert.equal(classifyError(new StepFailure('ainda há 2 tarefa(s) abertas')), 'recoverable');
  assert.equal(
    classifyError(new Error('Command failed: git commit -q\nhusky - pre-commit hook exited with code 1')),
    'recoverable',
  );
  assert.equal(classifyError(new TypeError('x is undefined')), 'engine');
  assert.equal(classifyError('texto solto'), 'engine');
  assert.equal(defaultWhatToDo(new NeedsHuman('a', 'faça b')), 'faça b');
});

test('assinatura: mesmo erro com números, hashes, caminhos e horários diferentes colide', () => {
  const a = errorSignature(
    'commitDelivery',
    'lint failed: 3 problems in /Users/x/repo/apps/backend/a.ts at 10:22:01 (abc1234)',
  );
  const b = errorSignature(
    'commitDelivery',
    'Lint failed: 5 problems in /tmp/outra/apps/backend/a.ts at 11:02:59 (def98765)\nmais detalhes',
  );
  assert.equal(a, b);
  assert.equal(a, 'commitDelivery:lint failed: # problems in a.ts at # (#)');
  assert.notEqual(errorSignature('apply', 'lint failed'), errorSignature('archive', 'lint failed'));
  assert.notEqual(errorSignature('apply', 'lint failed'), errorSignature('apply', 'build failed'));
});

test('proteção: acusa só o que a sessão trouxe (skip, ignore, teste apagado, arquivo novo)', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-guard-'));
  const g = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' });
  const write = (relative: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(repo, relative)), { recursive: true });
    fs.writeFileSync(path.join(repo, relative), text);
  };
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  write('app/src/a.ts', 'export const a = 1;\n');
  write('app/test/a.spec.ts', "it('a', () => {});\n");
  write('app/test/b.spec.ts', "it('b', () => {});\n");
  g('add', '.');
  g('commit', '-qm', 'base');

  // já havia uma supressão antes da sessão: não conta
  write('app/src/a.ts', 'export const a = 1;\n// @ts-expect-error legado\n');
  const before = snapshot(repo, ['app']);

  write('app/src/a.ts', 'export const a = 1;\n// @ts-expect-error legado\nexport const b = 2;\n');
  write('app/test/a.spec.ts', "it.skip('a', () => {});\n");
  fs.rmSync(path.join(repo, 'app/test/b.spec.ts'));
  write('app/src/novo.ts', '// eslint-disable-next-line\nexport const x = 1;\n');
  const findings = disablements(before, snapshot(repo, ['app']));
  assert.deepEqual(findings.sort(), [
    'app/src/novo.ts: // eslint-disable-next-line',
    "app/test/a.spec.ts: it.skip('a', () => {});",
    'app/test/b.spec.ts: arquivo de teste apagado',
  ]);
  assert.deepEqual(disablements(before, before), []);
  assert.deepEqual(disablements(snapshot(repo, []), snapshot(repo, [])), []);
});

test('prompt de recuperação preenche todas as chaves', () => {
  const values = {
    LOOP: 'm',
    NUMERO: 1,
    TOTAL: 2,
    NOME: 'm-01-a',
    PASSO: 'Arquivar a spec',
    SUCESSO: 's',
    ERRO: 'e',
    RELATORIO: 'r',
    STATUS: 'st',
    DIFF: 'd',
    ANTERIORES: 'nenhuma',
  };
  const text = buildPrompt('recuperar', values);
  assert.doesNotMatch(text, /\{\{[A-Z_]+\}\}/);
  assert.match(text, /Arquivar a spec/);
});

test('todos os prompts do motor existem e só usam chaves conhecidas', () => {
  const known = new Set([
    'LOOP',
    'TITULO',
    'PLANO',
    'ESCOPO',
    'ESCOPO_ARGS',
    'VERIFICACOES',
    'MOTOR',
    'LOOP_JSON',
    'NOME',
    'NUMERO',
    'TOTAL',
    'FASE',
    'ANTERIOR',
    'REGRAS_DA_SPEC',
    'LOTE',
    'TOTAL_LOTES',
    'TAREFAS',
    'ITERACAO',
    'ENTREGUES',
    'PENDENTES',
    'MOMENTO',
    'TENTATIVA',
    'MAX',
    'COMANDO',
    'ERRO',
    'ORIENTACAO',
    'SPECS',
    'OBJETIVO',
    'BRIEFING',
    'PASSO',
    'SUCESSO',
    'RELATORIO',
    'STATUS',
    'DIFF',
    'ANTERIORES',
    'REFERENCIA',
    'TAMANHO',
    'BASE',
  ]);
  const dir = path.resolve(import.meta.dirname, '../../src/loops/prompts');
  const names = fs.readdirSync(dir).filter((file) => file.endsWith('.md'));
  assert.ok(names.length >= 13);
  for (const name of names) {
    for (const [, key] of fs.readFileSync(path.join(dir, name), 'utf8').matchAll(/\{\{([A-Z_]+)\}\}/g))
      assert.ok(known.has(key as string), `${name}: {{${key}}}`);
  }
});
