import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_STEPS, STEP_INFO } from '../../../src/loops/config.js';
import { fill } from '../../../src/loops/prompts.js';
import { batchText } from '../../../src/loops/steps/apply.js';
import { buildBriefing, deliveriesText } from '../../../src/loops/steps/briefing.js';
import { deliveryMessage, proposalMessage, recordDelivery, reviewMessage } from '../../../src/loops/steps/commits.js';
import { stageToAnticipate } from '../../../src/loops/steps/early.js';
import { previousStage, proposalFromAnswer } from '../../../src/loops/steps/propose.js';
import { resolveSteps, STEPS } from '../../../src/loops/steps/registry.js';
import { exampleLoop, stage } from '../fixtures.js';

test('registro resolve os passos padrão e recusa id desconhecido', () => {
  assert.deepEqual(
    resolveSteps(DEFAULT_STEPS).steps.map((step) => step.id),
    DEFAULT_STEPS,
  );
  assert.deepEqual(Object.keys(STEPS).sort(), Object.keys(STEP_INFO).sort());
  const result = resolveSteps(['briefing', 'revisar-ux', 'commitDelivery']);
  assert.deepEqual(result.errors, ['passo desconhecido "revisar-ux" em config.steps']);
  assert.equal(result.steps.length, 0);
  assert.match(resolveSteps(['briefing']).errors[0] ?? '', /último passo/);
});

test('todo passo declara pós-condição e o que é sucesso', () => {
  for (const step of Object.values(STEPS)) {
    assert.equal(typeof step.postcondition, 'function', step.id);
    assert.ok(step.success.length > 10, step.id);
  }
});

test('briefing ignora prefixo de commit e exige descrição', () => {
  const first = stage(exampleLoop(), 0);
  assert.deepEqual(
    buildBriefing(first, { title: 'feat(web): tela nova', comparison: ' c ', description: ' d ' }).briefing,
    { title: 'tela nova', comparison: 'c', description: 'd' },
  );
  assert.equal(buildBriefing(first, { description: 'x' }).briefing?.title, 'A');
  assert.equal(buildBriefing(first, { title: 't' }).error, 'briefing sem descrição');
  assert.equal(buildBriefing(first, undefined).error, 'briefing sem descrição');
});

test('entregas viram texto para o briefing e a proposta', () => {
  const loop = exampleLoop();
  assert.match(deliveriesText(loop), /nenhuma etapa/);
  loop.stages[0] = { ...stage(loop, 0), status: 'delivered', commit: '0123456789abc' };
  assert.equal(deliveriesText(loop), '   - Etapa 1 · `web-x-01-a` · A · commit 012345678');
});

test('mensagens de commit usam o prefixo do loop', () => {
  const second = stage(exampleLoop(), 1);
  assert.equal(
    proposalMessage(second, { title: 'tela', comparison: '', description: '' }),
    'docs(openspec): propõe web-x-02-b\n\ntela',
  );
  const message = deliveryMessage({
    prefix: 'feat(web)',
    loop: 'web-x',
    stage: second,
    total: 2,
    title: 'tela',
    archived: 'openspec/changes/archive/2026-10-05-web-x-02-b',
  });
  assert.equal(message.split('\n')[0], 'feat(web): tela');
  assert.match(message, /etapa 2 de 2 do loop web-x/);
});

test('revisão da proposta antecipada tem commit próprio, sem repetir o "propõe"', () => {
  const second = stage(exampleLoop(), 1);
  assert.equal(
    reviewMessage(second, { title: 'tela', comparison: '', description: '' }).split('\n')[0],
    'docs(openspec): revisa web-x-02-b contra a etapa anterior entregue',
  );
});

test('o propose tira o título da própria resposta, sem prefixo de commit', () => {
  const first = stage(exampleLoop(), 0);
  assert.deepEqual(proposalFromAnswer(first, { title: 'feat(web): tela nova', comparison: ' c ' }), {
    title: 'tela nova',
    comparison: 'c',
    description: '',
  });
  assert.equal(proposalFromAnswer(first, undefined).title, 'A');
});

test('antecipa só a etapa seguinte, pendente, sem proposta antecipada e sem spec pronta', () => {
  const loop = exampleLoop();
  assert.equal(stageToAnticipate(loop, 1)?.number, 2);
  assert.equal(stageToAnticipate(loop, 2), undefined, 'a última etapa não tem seguinte');
  stage(loop, 1).early = { title: 't', comparison: '', base: 'a', commit: 'b', at: '' };
  assert.equal(stageToAnticipate(loop, 1), undefined);
  loop.stages[1] = { ...stage(loop, 1), early: undefined, readySpec: true };
  assert.equal(stageToAnticipate(loop, 1), undefined);
  loop.stages[1] = { ...stage(loop, 1), readySpec: undefined, status: 'delivered' };
  assert.equal(stageToAnticipate(loop, 1), undefined);
  assert.equal(previousStage(loop, 2)?.number, 1);
  assert.equal(previousStage(loop, 1), undefined);
});

test('entrega fecha a iteração, soma tempo e custo dos passos e conta a iteração', () => {
  const loop = exampleLoop();
  loop.iteration = {
    number: 3,
    stage: 2,
    startCommit: 'a',
    startedAt: '',
    currentStep: 7,
    steps: [
      { id: 'propose', state: 'ok', durationMs: 1000, cost: 0.5, attempts: 2 },
      { id: 'apply', state: 'ok', durationMs: 4000, cost: 2, attempts: 1 },
    ],
  };
  recordDelivery(loop, loop.iteration, new Date('2026-10-05T10:00:00Z'));
  assert.equal(loop.iteration, null);
  assert.equal(loop.totals.iterationsDelivered, 1);
  const delivered = stage(loop, 1);
  assert.deepEqual(
    [delivered.status, delivered.iteration, delivered.durationMs, delivered.cost, delivered.deliveredAt],
    ['delivered', 3, 5000, 2.5, '2026-10-05T10:00:00.000Z'],
  );
  assert.equal(delivered.steps?.length, 2);
});

test('lote vira texto com os grupos e as tarefas abertas', () => {
  assert.equal(batchText([{ title: '1. Base', done: 1, open: ['1.2 x'] }]), '### 1. Base\n\n- [ ] 1.2 x');
  assert.equal(fill('{{A}} {{B}}', { A: 1 }), '1 {{B}}');
});
