import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toKebab } from '../../src/loops/format.js';
import { parsePlan, planStages, renderPlan, usesReadySpec, validatePlan } from '../../src/loops/plan.js';

const PLAN = `# Cancelamento de pedidos

## Objetivo

Permitir que o cliente cancele um pedido ainda não enviado.

## Regras

### Arquitetura

- Siga o README do backend.

## Fase 1 · Fundamentos

1. **Domínio** · \`pedidos-cancelamento-01-dominio\` — cria a regra no módulo
   e os testes.
2. **Endpoint** · \`pedidos-cancelamento-02-endpoint\` — a rota.

## Fase 2 · Fechamento

3. **Varredura** · \`pedidos-cancelamento-03-varredura\`

## Fora do escopo

Reembolso automático.
`;

const at = <T>(list: T[], index: number): T => {
  const item = list[index];
  if (item === undefined) throw new Error(`índice ${index} ausente`);
  return item;
};

test('lê título, objetivo, regras com subtítulos, fases, etapas e fora do escopo', () => {
  const plan = parsePlan(PLAN);
  assert.equal(plan.title, 'Cancelamento de pedidos');
  assert.equal(plan.goal, 'Permitir que o cliente cancele um pedido ainda não enviado.');
  assert.match(plan.rules, /### Arquitetura/);
  assert.equal(plan.outOfScope, 'Reembolso automático.');
  assert.deepEqual(
    plan.phases.map((phase) => [phase.name, phase.stages.length]),
    [
      ['Fundamentos', 2],
      ['Fechamento', 1],
    ],
  );
  const stages = planStages(plan);
  assert.deepEqual(at(stages, 0), {
    number: 1,
    phase: 'Fundamentos',
    title: 'Domínio',
    change: 'pedidos-cancelamento-01-dominio',
    description: 'cria a regra no módulo e os testes.',
  });
  assert.equal(at(stages, 2).description, '');
  assert.deepEqual(validatePlan(plan, 'pedidos-cancelamento'), []);
});

test('numeração fora de sequência é apontada', () => {
  const plan = parsePlan(
    PLAN.replace(
      '3. **Varredura** · `pedidos-cancelamento-03-varredura`',
      '4. **Varredura** · `pedidos-cancelamento-04-varredura`',
    ),
  );
  assert.ok(
    validatePlan(plan, 'pedidos-cancelamento').some((problem) => problem.includes('etapa 4 fora de sequência')),
  );
});

test('nome de change fora do padrão indica o formato esperado', () => {
  const plan = parsePlan(PLAN.replace('pedidos-cancelamento-02-endpoint', 'pedidos-cancelamento-2-endpoint'));
  assert.deepEqual(validatePlan(plan, 'pedidos-cancelamento'), [
    'etapa 2: change "pedidos-cancelamento-2-endpoint" fora do padrão pedidos-cancelamento-02-<assunto>',
  ]);
  assert.equal(validatePlan(parsePlan(PLAN), 'outro-loop').length, 3);
});

test('spec pronta: marcada no plano, com qualquer nome, desde que exista', () => {
  const plan = parsePlan(
    PLAN.replace('`pedidos-cancelamento-02-endpoint` — a rota', '`rota-de-cancelamento` · spec pronta — a rota'),
  );
  const stages = planStages(plan);
  const second = at(stages, 1);
  assert.deepEqual(
    [second.change, second.description, usesReadySpec(second), usesReadySpec(at(stages, 0))],
    ['rota-de-cancelamento', 'a rota.', true, false],
  );
  assert.deepEqual(
    validatePlan(plan, 'pedidos-cancelamento', (change) => change === 'rota-de-cancelamento'),
    [],
  );
  assert.deepEqual(
    validatePlan(plan, 'pedidos-cancelamento', () => false),
    ['etapa 2: a spec pronta "rota-de-cancelamento" não existe em openspec/changes'],
  );
  // a marca volta igual depois de renderizar
  assert.ok(usesReadySpec(at(planStages(parsePlan(renderPlan(plan))), 1)));
  // sem a marca, o nome fora do padrão continua sendo erro, mesmo se a change existir
  const unmarked = parsePlan(PLAN.replace('pedidos-cancelamento-02-endpoint', 'rota-de-cancelamento'));
  assert.equal(validatePlan(unmarked, 'pedidos-cancelamento', () => true).length, 1);
  // e uma spec pronta pode ter um nome no padrão do loop: é a marca que decide
  const inPattern = parsePlan(
    PLAN.replace(
      '`pedidos-cancelamento-02-endpoint` — a rota',
      '`pedidos-cancelamento-02-endpoint` · spec pronta — a rota',
    ),
  );
  assert.ok(usesReadySpec(at(planStages(inPattern), 1)));
});

test('etapa sem change, repetida ou fora de fase', () => {
  const plan = parsePlan('# X\n\n1. **Solta** · `x-01-a`\n\n## Fase 1 · F\n\n1. **A** · `x-01-a`\n2. **B**\n');
  const problems = validatePlan(plan, 'x');
  assert.ok(problems.some((problem) => problem.includes('fora de uma fase')));
  assert.ok(problems.some((problem) => problem.includes('etapa 2 sem nome de change')));
  assert.equal(validatePlan(parsePlan('# vazio'), 'x').length, 1);
});

test('renderizar e ler de novo devolve o mesmo plano', () => {
  const plan = parsePlan(PLAN);
  assert.deepEqual(parsePlan(renderPlan(plan)), plan);
});

test('kebab sem acentos', () => {
  assert.equal(toKebab('Relatórios de Ação!'), 'relatorios-de-acao');
  assert.equal(toKebab('  --a  b-- '), 'a-b');
});
