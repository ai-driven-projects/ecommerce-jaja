import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  approve,
  discardDraft,
  overlappingScopes,
  preflight,
  readControl,
  requestPause,
} from '../../src/loops/control.js';
import { loopPaths, readLoop, saveLoop } from '../../src/loops/loops.js';
import { exampleLoop } from './fixtures.js';

function repo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-ctl-'));
  const g = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  g('init', '-q');
  g('config', 'user.email', 't@t');
  g('config', 'user.name', 't');
  fs.mkdirSync(path.join(root, 'apps/web'), { recursive: true });
  fs.writeFileSync(path.join(root, 'apps/web/a.ts'), 'a');
  g('add', '.');
  g('commit', '-qm', 'base');
  const paths = loopPaths('web-x', root);
  saveLoop(paths, exampleLoop('web-x'));
  fs.writeFileSync(paths.plan, '# Exemplo\n\n## Fase 1 · F1\n\n1. **A** · `web-x-01-a`\n2. **B** · `web-x-02-b`\n');
  return { root, paths };
}

const has = (list: string[], part: string) => list.some((problem) => problem.includes(part));

test('pré-requisitos: rascunho, plano alterado, passo desconhecido e escopo sujo impedem o início', () => {
  const { root, paths } = repo();
  assert.ok(!has(preflight('web-x', root).problems, 'escopo'));

  fs.writeFileSync(path.join(root, 'apps/web/a.ts'), 'mudou');
  assert.ok(has(preflight('web-x', root).problems, 'alterações não commitadas no escopo do loop: '));

  fs.appendFileSync(paths.plan, '3. **C** · `web-x-03-c`\n');
  assert.ok(has(preflight('web-x', root).problems, 'o plano.md mudou desde a aprovação'));
  assert.deepEqual(approve('web-x', root), []);
  assert.equal(readLoop(paths).stages.length, 3);
  assert.ok(!has(preflight('web-x', root).problems, 'plano.md mudou'));

  saveLoop(paths, {
    ...readLoop(paths),
    status: 'draft',
    config: { ...readLoop(paths).config, steps: ['revisar-ux'] },
  });
  const result = preflight('web-x', root);
  assert.ok(has(result.problems, 'rascunho'));
  assert.ok(has(result.problems, 'passo desconhecido "revisar-ux"'));
});

test('retomada de uma iteração aceita o escopo sujo', () => {
  const { root, paths } = repo();
  fs.writeFileSync(path.join(root, 'apps/web/a.ts'), 'mudou');
  saveLoop(paths, {
    ...readLoop(paths),
    status: 'interrupted',
    iteration: { number: 1, stage: 1, startCommit: 'x', startedAt: '', currentStep: 4, steps: [] },
  });
  assert.ok(!has(preflight('web-x', root).problems, 'escopo'));
});

test('pausa vai para o controle.json; só rascunho pode ser descartado', () => {
  const { root, paths } = repo();
  requestPause('web-x', true, root);
  assert.equal(readControl(paths).pause, true);
  requestPause('web-x', false, root);
  assert.equal(readControl(paths).pause, false);
  assert.match(discardDraft('web-x', root) ?? '', /só rascunhos/);
  saveLoop(paths, { ...readLoop(paths), status: 'draft' });
  assert.equal(discardDraft('web-x', root), undefined);
  assert.ok(!fs.existsSync(paths.dir));
});

test('escopos sobrepostos', () => {
  assert.deepEqual(overlappingScopes(['apps/backend'], ['apps/backend/src']), ['apps/backend']);
  assert.deepEqual(overlappingScopes(['apps/backend'], ['apps/backend-x']), []);
  assert.deepEqual(overlappingScopes(['apps/frontend'], ['apps/backend']), []);
});
