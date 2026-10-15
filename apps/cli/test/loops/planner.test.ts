import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { approvePlan } from '../../src/loops/loops.js';
import { parsePlan, planStages, renderPlan } from '../../src/loops/plan.js';
import { buildLoopFromPlanning, buildLoopFromSpecs } from '../../src/loops/planner.js';

const ANSWER = {
  title: 'Cancelamento de pedidos',
  rules: '- Siga o README do backend.',
  outOfScope: 'Reembolso automático.',
  phases: [
    {
      name: 'Fundamentos',
      stages: [
        { title: 'Domínio', subject: 'Regra de Domínio', description: 'cria a\nregra' },
        { title: 'Endpoint', subject: 'rota-de-cancelamento', description: 'a rota' },
      ],
    },
    { name: 'Fechamento', stages: [{ title: 'Varredura', subject: '', description: '' }] },
  ],
  scope: ['./apps/backend/', '../fora', '/abs'],
  commitPrefix: 'feat(backend)',
  requiredCommands: ['git', 'docker'],
  checks: [{ label: 'Testes do backend', command: 'npm  run test', dir: 'apps/backend' }],
};

test('planejamento vira plano válido e loop em rascunho, com nomes de change gerados', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loops-plan-'));
  fs.mkdirSync(path.join(root, 'apps/backend'), { recursive: true });
  const result = buildLoopFromPlanning('pedidos-cancelamento', ' Cancelar pedidos ', ANSWER, {
    root,
    now: new Date('2026-10-05T00:00:00Z'),
    totals: { cost: 0.7, claudeSessions: 1 },
  });
  assert.deepEqual(result.errors, []);
  const plan = result.plan;
  const loop = result.loop;
  assert.ok(plan && loop);
  assert.deepEqual(
    planStages(plan).map((stage) => stage.change),
    [
      'pedidos-cancelamento-01-regra-de-dominio',
      'pedidos-cancelamento-02-rota-de-cancelamento',
      'pedidos-cancelamento-03-varredura',
    ],
  );
  assert.equal(planStages(plan)[0]?.description, 'cria a regra');
  assert.equal(loop.status, 'draft');
  assert.deepEqual(loop.config.scope, ['apps/backend']);
  assert.deepEqual(loop.config.requiredCommands, ['docker']);
  assert.deepEqual(loop.config.checks, [
    { id: 'testes-do-backend', label: 'Testes do backend', command: ['npm', 'run', 'test'], dir: 'apps/backend' },
  ]);
  assert.equal(loop.totals.cost, 0.7);
  assert.equal(loop.totals.runs, 0);

  // o plano renderizado é lido e aprovado como está
  const approved = approvePlan(loop, parsePlan(renderPlan(plan)), root);
  assert.deepEqual(approved.errors, []);
  assert.equal(approved.loop?.stages.length, 3);
  assert.equal(approved.loop?.status, 'pending');
});

test('resposta sem fases é recusada', () => {
  assert.deepEqual(buildLoopFromPlanning('x', 'o', { phases: [] }).errors, [
    'a resposta do planejamento não trouxe fases',
  ]);
  assert.equal(buildLoopFromPlanning('x', 'o', undefined).errors.length, 1);
});

test('sem escopo nem verificações gera avisos, não erro', () => {
  const result = buildLoopFromPlanning('x', 'o', { ...ANSWER, scope: [], checks: [] });
  assert.equal(result.errors.length, 0);
  assert.equal(result.warnings.length, 2);
});

test('loop de specs existentes: etapas na ordem escolhida, com os nomes das changes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-specs-'));
  for (const name of ['usuarios-na-raiz', 'busca-v2']) {
    fs.mkdirSync(path.join(root, 'openspec/changes', name), { recursive: true });
    fs.writeFileSync(path.join(root, 'openspec/changes', name, 'proposal.md'), `## Why\n\nResumo de ${name}.\n`);
  }
  const answer = {
    ...ANSWER,
    goal: 'Entregar as duas specs.',
    // o Claude trocou a ordem e esqueceu uma: quem manda é a escolha do usuário
    stages: [{ change: 'busca-v2', title: 'Busca nova', description: 'a busca' }],
  };
  const result = buildLoopFromSpecs('specs-x', ['usuarios-na-raiz', 'busca-v2'], answer, { root });
  assert.deepEqual(result.errors, []);
  assert.ok(result.plan && result.loop);
  assert.deepEqual(
    planStages(result.plan).map((stage) => [stage.number, stage.change, stage.title, stage.description]),
    [
      [1, 'usuarios-na-raiz', 'usuarios-na-raiz', 'Resumo de usuarios-na-raiz.'],
      [2, 'busca-v2', 'Busca nova', 'a busca'],
    ],
  );
  assert.ok(planStages(result.plan).every((stage) => stage.readySpec));
  assert.equal(result.plan.goal, 'Entregar as duas specs.');
  assert.equal(result.loop.status, 'draft');
  // o plano gravado volta igual e é aprovado com as changes existentes
  assert.deepEqual(approvePlan(result.loop, parsePlan(renderPlan(result.plan)), root).errors, []);
});

test('loop de specs recusa change que não existe', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-specs-'));
  const result = buildLoopFromSpecs('specs-x', ['nao-existe'], {}, { root });
  assert.match(result.errors[0] ?? '', /spec pronta "nao-existe" não existe/);
  assert.deepEqual(buildLoopFromSpecs('specs-x', [], {}, { root }).errors, ['nenhuma spec escolhida']);
});
