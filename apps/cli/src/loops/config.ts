import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectProject } from '../core/project.js';
import type { EffectiveConfig, Limits, LoopConfig, StepId } from './types.js';

/**
 * Variáveis de ambiente lidas em runtime pelo motor (os testes encurtam as esperas e trocam a raiz).
 * Centralizadas aqui para o resto do motor não ler `process.env` solto.
 */
export const ENV = {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- leitura em runtime, não input de build
  root: () => process.env.LOOPS_ROOT,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  iterationIntervalMs: () => Number(process.env.LOOPS_INTERVAL_MS) || 3000,
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  checkRetryWaitMs: () => Number(process.env.LOOPS_RETRY_WAIT_MS) || 10_000,
};

let detectedRoot: string | undefined;

/** Raiz do repositório em que os loops trabalham (os testes e os processos do vigia usam LOOPS_ROOT). */
export function loopsRoot(): string {
  const fromEnv = ENV.root();
  if (fromEnv) return fromEnv;
  detectedRoot ??= detectProject().rootDir;
  return detectedRoot;
}

/** Pasta do motor (apps/cli/src/loops, ou dist/loops no binário compilado). */
export const ENGINE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Pasta do CLI (apps/cli). */
export const CLI_DIR = path.resolve(ENGINE_DIR, '../..');

/** O que o Claude não pode editar: o código do motor e o que foi compilado dele. */
export const ENGINE_PATHS = [path.join(CLI_DIR, 'src/loops'), path.join(CLI_DIR, 'dist/loops')];

export const DEFAULT_LIMITS: Limits = {
  iterationsPerRun: 25,
  fixes: 3,
  continuations: 2,
  attemptsPerStep: 3,
  recoveriesPerIteration: 5,
  tasksPerSession: 10,
  restarts: 4,
  sessionMin: 60,
  sessionIdleMin: 10,
  commandMin: 15,
};

/** Os passos de uma iteração, na ordem padrão de todos os loops. */
export const DEFAULT_STEPS: StepId[] = [
  'propose',
  'baseline',
  'commitProposal',
  'apply',
  'verifyChange',
  'archive',
  'commitDelivery',
];

/** Nome e descrição de cada passo, para as telas (sem carregar o motor). */
export const STEP_INFO: Record<StepId, { label: string; description: string }> = {
  briefing: {
    label: 'Preparar o briefing',
    description: 'Claude lê o plano e o código e escreve o briefing da etapa (opcional)',
  },
  propose: {
    label: 'Propor a spec',
    description: 'Claude estuda a etapa e escreve proposal, specs, design e tasks (OpenSpec propose)',
  },
  baseline: { label: 'Verificar ponto de partida', description: 'verificações do loop antes de mudar qualquer coisa' },
  commitProposal: { label: 'Commit da proposta', description: 'git commit da spec proposta' },
  apply: { label: 'Aplicar a spec', description: 'OpenSpec apply: o Claude implementa as tarefas, um lote por sessão' },
  verifyChange: { label: 'Verificar a mudança', description: 'verificações do loop depois da mudança, com correções' },
  archive: { label: 'Arquivar a spec', description: 'OpenSpec archive: arquiva e sincroniza as specs' },
  commitDelivery: { label: 'Commit da entrega', description: 'git commit da entrega' },
};

export const stepLabel = (id: string) => STEP_INFO[id as StepId]?.label ?? id;

/** Limites ausentes ou inválidos (não numéricos, zero, negativos) ficam com o padrão. */
export function effectiveConfig(config: LoopConfig): EffectiveConfig {
  const limits = { ...DEFAULT_LIMITS };
  for (const key of Object.keys(DEFAULT_LIMITS) as (keyof Limits)[]) {
    const value = Number(config.limits?.[key]);
    if (Number.isFinite(value) && value > 0) limits[key] = value;
  }
  return { ...config, limits };
}

/**
 * Códigos de saída do processo da iteração. O vigia decide por eles: entregue →
 * próxima iteração num processo novo; concluído, pausado, falha registrada ou
 * interrupção → para; qualquer outro código ou sinal é crash → recupera.
 */
export const EXIT = {
  delivered: 0,
  unexpected: 1,
  done: 10,
  paused: 11,
  failed: 12,
  waiting: 13,
  interrupted: 130,
} as const;

export const TRAILER = 'Co-Authored-By: Claude <noreply@anthropic.com>';

/** Versionamento, instalação e publicação são do script, nunca do Claude. */
export const GENERAL_FORBIDDEN_TOOLS = [
  'Bash(git commit:*)',
  'Bash(git push:*)',
  'Bash(git reset:*)',
  'Bash(git checkout:*)',
  'Bash(git restore:*)',
  'Bash(git stash:*)',
  'Bash(git clean:*)',
  'Bash(git switch:*)',
  'Bash(git rebase:*)',
  'Bash(git merge:*)',
  'Bash(git branch:*)',
  'Bash(git tag:*)',
  'Bash(npm install:*)',
  'Bash(npm i:*)',
  'Bash(npm ci:*)',
  'Bash(npm uninstall:*)',
  'Bash(npm publish:*)',
  'Bash(yarn install:*)',
  'Bash(yarn add:*)',
  'Bash(yarn publish:*)',
  'Bash(pnpm install:*)',
  'Bash(pnpm add:*)',
];

/** Comandos que todo loop precisa. */
export const BASIC_COMMANDS = ['claude', 'openspec', 'git'];
