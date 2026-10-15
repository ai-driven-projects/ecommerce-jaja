/**
 * Recuperação de falhas por agente: classifica o erro de um passo, calcula a
 * assinatura dele e, quando faz sentido, abre uma sessão do Claude focada no
 * erro. Quem decide se resolveu é a pós-condição do passo, conferida pelo motor.
 */
import fs from 'node:fs';
import { stepLabel } from './config.js';
import { errorMessage, oneLine } from './format.js';
import { git, status } from './git.js';
import { disablements, snapshot } from './guard.js';
import { buildPrompt, RECOVERY_SCHEMA } from './prompts.js';
import { claude } from './steps/common.js';
import { Cancelled, type IterationContext, iterationOf, NeedsHuman, type Step, StepFailure } from './steps/context.js';
import type { RecoveryRecord } from './types.js';

export type ErrorClass = 'human' | 'engine' | 'recoverable';

/** Autenticação recusada: só uma pessoa resolve. */
const AUTHENTICATION =
  /not logged in|please run \/login|invalid api key|could not read username|permission denied \(publickey\)|authentication failed|\b401\b|unauthorized/i;

/** Erros de programação: bug do motor, não do resultado do passo. */
const PROGRAMMING_ERRORS = [TypeError, ReferenceError, SyntaxError, RangeError];

export function classifyError(error: unknown): ErrorClass {
  if (error instanceof NeedsHuman) return 'human';
  if (!(error instanceof Error)) return 'engine';
  if (PROGRAMMING_ERRORS.some((type) => error instanceof type)) return 'engine';
  // StepFailure ou erro de um comando dentro do passo (ex.: git commit recusado por um hook)
  const tail = error instanceof StepFailure ? (error.details.tail ?? []).join('\n') : '';
  return AUTHENTICATION.test(`${error.message}\n${tail}`) ? 'human' : 'recoverable';
}

/** O que fazer quando a classificação é "human" sem instrução explícita. */
export function defaultWhatToDo(error: unknown): string {
  if (error instanceof NeedsHuman) return error.whatToDo;
  return 'confira a autenticação (claude, git) indicada no erro e continue o loop';
}

/**
 * Assinatura estável de uma falha: passo + primeira linha do erro, sem números,
 * hashes, caminhos absolutos e horários. Erros "iguais" com detalhes diferentes
 * (3 ou 5 problemas de lint) colidem de propósito.
 */
export function errorSignature(step: string, message: string): string {
  const first = (message.split('\n').find((line) => line.trim()) ?? '').toLowerCase();
  const normalized = first
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, '#')
    .replace(/(\/[\w.@+-]+)+\/([\w.@+-]+)/g, '$2')
    .replace(/\b[0-9a-f]{7,40}\b/g, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
  return `${step}:${normalized}`;
}

// ─── a sessão de recuperação ─────────────────────────────────────────────────

const MAX_REPORT = 12 * 1024;
const MAX_STATUS_LINES = 60;

export type RecoveryOutcome =
  | { outcome: 'resolved' }
  | { outcome: 'rerun'; reason: string }
  | { outcome: 'human'; reason: string; whatToDo: string };

interface RecoveryAnswer {
  resolved?: boolean;
  cause?: string;
  whatItDid?: string;
  needsHuman?: boolean;
  whatToDo?: string;
}

function previousText(previous: RecoveryRecord[]): string {
  if (!previous.length) return 'Nenhuma: esta é a primeira recuperação deste passo.';
  return previous
    .map(
      (r) =>
        `- Recuperação ${r.number} (${r.resolved ? 'resolveu' : 'não resolveu'}): erro "${r.error}". Causa: ${r.cause ?? '?'}. O que fez: ${r.whatItDid ?? '?'}`,
    )
    .join('\n');
}

/**
 * Abre uma sessão nova do Claude focada no erro do passo, aplica a proteção e
 * confere a pós-condição. O resultado diz se o passo pode seguir, se deve ser
 * executado de novo ou se o loop precisa de uma pessoa.
 */
export async function recover(
  ctx: IterationContext,
  step: Step,
  index: number,
  error: Error,
  report: string,
  signature: string,
): Promise<RecoveryOutcome> {
  const root = ctx.paths.root;
  const change = ctx.stage.change;
  const record = iterationOf(ctx).steps[index];
  if (!record) throw new Error(`passo ${index} fora da iteração`);
  const previous = record.recoveries ?? [];
  const number = previous.length + 1;
  const paths = [...ctx.config.scope, `openspec/changes/${change}`];
  const tail =
    error instanceof StepFailure && error.details.tail?.length ? `\n\n${error.details.tail.slice(-40).join('\n')}` : '';
  let reportText = '';
  try {
    reportText = fs.readFileSync(report, 'utf8').slice(0, MAX_REPORT);
  } catch {
    // sem relatório, a sessão trabalha só com o erro
  }

  const item = ctx.monitor.item('recovery', `Recuperando: ${oneLine(error.message, 90)}`);
  ctx.monitor.log('warn', `↻ recuperação ${number} do passo ${stepLabel(step.id)}: ${error.message}`);
  ctx.monitor.count('recoveries');
  const costBefore = record.cost;
  const before = snapshot(root, paths);

  let answer: RecoveryAnswer;
  try {
    const end = await claude(
      ctx,
      `recuperar-${step.id}-${number}`,
      buildPrompt('recuperar', {
        ...ctx.values,
        PASSO: stepLabel(step.id),
        SUCESSO: step.success.replaceAll('<change>', change),
        ERRO: `${error.message}${tail}`,
        RELATORIO: reportText || '(sem relatório)',
        STATUS: status(root, paths).slice(0, MAX_STATUS_LINES).join('\n') || '(nada alterado)',
        DIFF: git(root, ['diff', '--stat', 'HEAD', '--', ...paths]) || '(sem diff)',
        ANTERIORES: previousText(previous),
      }),
      { schema: RECOVERY_SCHEMA },
    );
    answer = (end.result?.structured_output ?? {}) as RecoveryAnswer;
  } catch (failure) {
    if (failure instanceof Cancelled) throw failure;
    // a sessão de recuperação falhar é uma recuperação não resolvida, não uma falha nova
    answer = { cause: `a sessão de recuperação falhou: ${errorMessage(failure)}` };
  }

  // a sessão pode ter trocado a referência do passo (ex.: commitDelivery restaurou o loop.json)
  const current = iterationOf(ctx).steps[index] ?? record;
  const entry: RecoveryRecord = {
    number,
    error: oneLine(error.message, 300),
    signature,
    cause: answer.cause,
    whatItDid: answer.whatItDid,
    resolved: false,
    needsHuman: answer.needsHuman || undefined,
    cost: Math.max(0, current.cost - costBefore),
    at: new Date().toISOString(),
  };
  const register = () => {
    current.recoveries = [...(current.recoveries ?? []), entry];
    ctx.save();
    ctx.monitor.event('recovery', { ...entry });
  };

  const refused = disablements(before, snapshot(root, paths));
  if (refused.length) {
    entry.refused = refused;
    register();
    item.failed('recusada: desligava verificações');
    return {
      outcome: 'human',
      reason: `a recuperação do passo ${stepLabel(step.id)} desligou verificações e foi recusada`,
      whatToDo: `revise e desfaça estas mudanças, depois continue: ${refused.slice(0, 3).join('; ')}${refused.length > 3 ? '…' : ''}`,
    };
  }
  if (answer.needsHuman) {
    register();
    item.warn('precisa de uma pessoa');
    return {
      outcome: 'human',
      reason: answer.cause || error.message,
      whatToDo: answer.whatToDo?.trim() || 'veja a causa nos detalhes do loop e continue depois de resolver',
    };
  }

  const missing = await step.postcondition(ctx);
  entry.resolved = missing.length === 0;
  register();
  if (entry.resolved) {
    ctx.monitor.count('recoveriesResolved');
    item.ok(oneLine(answer.cause ?? 'resolvido', 90));
    ctx.monitor.log('ok', `↻ recuperação ${number} resolveu: ${answer.cause ?? ''}`);
    return { outcome: 'resolved' };
  }
  item.failed(oneLine(missing.join('; '), 90));
  ctx.monitor.log('warn', `↻ recuperação ${number} não resolveu: ${missing.join('; ')}`);
  return { outcome: 'rerun', reason: missing.join('; ') };
}
