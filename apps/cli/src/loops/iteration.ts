/**
 * Uma iteração do loop, num processo próprio e sem interface: entrega no máximo
 * uma etapa do plano e termina com um código de EXIT que o vigia interpreta.
 *
 *   node --import tsx src/loops/iteration.ts <nome-do-loop>     (ou dist/loops/iteration.js)
 *
 * Todo o estado necessário para retomar fica no loop.json (salvo antes e depois
 * de cada tentativa de passo); nada passa de uma iteração para outra em memória.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksText, checkScope } from './steps/common.js';
import { Cancelled, type IterationContext, PauseRequested, StepFailure } from './steps/context.js';
import { resolveSteps } from './steps/registry.js';
import { effectiveConfig, ENGINE_PATHS, EXIT, GENERAL_FORBIDDEN_TOOLS, loopsRoot, stepLabel } from './config.js';
import { readJson } from './files.js';
import { clock, errorMessage, longDuration } from './format.js';
import { head, outsideScope, pathspecsThatMustBeClean, pendingReadySpecs, status } from './git.js';
import {
  iterationDir,
  type LoopPaths,
  loopPaths,
  markArchived,
  nextStage,
  planDivergences,
  readLoop,
  readLoopPlan,
  saveLoop,
} from './loops.js';
import { Monitor } from './monitor.js';
import { isEntry } from './node.js';
import type { Plan } from './plan.js';
import { killChildren, setChildrenRegistry } from './process.js';
import { buildSystem } from './prompts.js';
import { classifyError, defaultWhatToDo, errorSignature, recover, type RecoveryOutcome } from './recovery.js';
import type { Control, Iteration, IterationStep, Loop, LoopStage } from './types.js';

const newStep = (id: string): IterationStep => ({ id, state: 'pending', durationMs: 0, cost: 0, attempts: 0 });

export function newIteration(
  loop: Loop,
  stage: LoopStage,
  startCommit: string,
  ids: string[],
  now = new Date(),
): Iteration {
  return {
    number: loop.totals.iterationsStarted + 1,
    stage: stage.number,
    startCommit,
    startedAt: now.toISOString(),
    currentStep: 0,
    steps: ids.map(newStep),
  };
}

/**
 * Ajusta os passos de uma iteração retomada à configuração atual (que pode ter
 * mudado entre execuções), preservando o que já foi feito em cada id. A retomada
 * começa no primeiro passo não concluído.
 */
export function alignSteps(iteration: Iteration, ids: string[]): Iteration {
  const steps: IterationStep[] = ids.map((id) => iteration.steps.find((step) => step.id === id) ?? newStep(id));
  const finished = (step: IterationStep) => step.state === 'ok' || step.state === 'skipped';
  const firstOpen = steps.findIndex((step) => !finished(step));
  for (const step of steps.slice(Math.max(0, firstOpen))) if (step.state === 'running') step.state = 'pending';
  return { ...iteration, steps, currentStep: firstOpen < 0 ? steps.length : firstOpen };
}

const readControl = (paths: LoopPaths): Control => {
  const read = readJson<Control>(paths.control);
  return read.ok ? read.value : { pause: false };
};

/** Relatório de falha: tudo o que ajuda a entender o erro e melhorar o loop. */
function failureReport(
  paths: LoopPaths,
  monitor: Monitor,
  loop: Loop,
  iteration: Iteration,
  index: number,
  error: Error,
  dir: string,
): string {
  fs.mkdirSync(dir, { recursive: true });
  const step = iteration.steps[index];
  const file = path.join(dir, `falha-passo-${index + 1}-${clock(Date.now()).replace(/:/g, '')}.md`);
  const details = error instanceof StepFailure ? error.details : {};
  const stage = loop.stages.find((s) => s.number === iteration.stage);
  const text = [
    `# Falha no passo ${index + 1} · ${stepLabel(step?.id ?? '')}`,
    '',
    `- Quando: ${new Date().toISOString()}`,
    `- Loop: \`${loop.name}\` · iteração ${iteration.number} · etapa ${iteration.stage} · change \`${stage?.change ?? '?'}\``,
    `- Commit de início da iteração: ${iteration.startCommit.slice(0, 9)}`,
    `- Tentativas do passo: ${step?.attempts ?? 0}`,
    `- Erro: ${error.message}`,
    details.file ? `- Log principal: \`${path.relative(paths.root, details.file)}\`` : '',
    '',
    '## Itens do passo',
    '',
    ...monitor.live.items.map((item) => `- [${item.state}] ${item.label}${item.detail ? ` — ${item.detail}` : ''}`),
    '',
    details.tail?.length ? `## Final da saída\n\n\`\`\`\n${details.tail.join('\n')}\n\`\`\`\n` : '',
    '## Últimas ações do Claude',
    '',
    ...monitor.live.activities.slice(-25).map((a) => `- ${clock(a.ts)} ${a.kind === 'tool' ? '→' : '💬'} ${a.text}`),
    '',
    '## Últimas linhas do log',
    '',
    '```',
    ...monitor.logs.slice(-60).map((line) => `[${clock(line.ts)}] ${line.level.padEnd(7)} ${line.text}`),
    '```',
    '',
    '## Como retomar',
    '',
    'Continue o loop pelo CLI (`npm run cli -- loops`, ou `npm run cli -- loops:start --loop=<nome>`): ele retoma deste passo. Os arquivos ficam como estão.',
  ].join('\n');
  fs.writeFileSync(file, text);
  return file;
}

/** Roda uma iteração e devolve o código de saída. */
export async function runIteration(name: string, root = loopsRoot()): Promise<number> {
  const paths = loopPaths(name, root);
  setChildrenRegistry(paths.children);
  const state = { loop: readLoop(paths) };
  const save = () => saveLoop(paths, state.loop);

  const recordReason = (reason: string, whatToDo?: string) => {
    state.loop.lastRun = { start: new Date().toISOString(), ...state.loop.lastRun, reason, whatToDo };
    save();
    console.error(`iteração · ${reason}${whatToDo ? ` → ${whatToDo}` : ''}`);
  };
  /** Antes de começar: o que impede a iteração depende de uma pessoa, sem gastar o Claude. */
  const waitBefore = (reason: string, whatToDo: string) => {
    recordReason(reason, whatToDo);
    return EXIT.waiting;
  };

  const config = effectiveConfig(state.loop.config);
  const { steps, errors } = resolveSteps(config.steps);
  if (errors.length) return waitBefore(errors.join('; '), 'corrija config.steps no loop.json e continue');
  let plan: Plan;
  try {
    plan = readLoopPlan(paths);
  } catch {
    return waitBefore('plano.md não encontrado', `restaure ${path.relative(root, paths.plan)} e continue`);
  }
  const divergences = planDivergences(state.loop, plan);
  if (divergences.length) {
    return waitBefore(
      `o plano.md mudou desde a aprovação (${divergences[0]}${divergences.length > 1 ? '…' : ''})`,
      'aprove o plano de novo na tela do loop (a) e continue',
    );
  }
  if (markArchived(state.loop, root)) save();

  if (!state.loop.iteration) {
    const stage = nextStage(state.loop);
    if (!stage) {
      console.log('iteração · todas as etapas do plano foram entregues');
      return EXIT.done;
    }
    const dirty = status(root, pathspecsThatMustBeClean(config.scope, name, pendingReadySpecs(state.loop.stages)));
    if (dirty.length) {
      return waitBefore(
        `há alterações não commitadas no escopo do loop (${dirty.slice(0, 5).join(', ')}${dirty.length > 5 ? '…' : ''})`,
        'commite ou guarde (stash) essas alterações e continue: uma etapa nova só começa com o escopo limpo',
      );
    }
    state.loop.iteration = newIteration(state.loop, stage, head(root), config.steps);
    state.loop.totals.iterationsStarted++;
    save();
  } else {
    state.loop.iteration = alignSteps(state.loop.iteration, config.steps);
    save();
  }

  const it0 = state.loop.iteration;
  const stage = state.loop.stages.find((s) => s.number === it0.stage);
  if (!stage)
    return waitBefore(
      `a etapa ${it0.stage} da iteração em andamento não existe mais no plano`,
      'restaure a etapa no plano.md e aprove de novo',
    );
  const dir = iterationDir(paths, it0.number);
  fs.mkdirSync(dir, { recursive: true });

  const monitor = new Monitor(paths, state, save);
  const control = new AbortController();
  const onSignal = (signal: string) => {
    if (control.signal.aborted) return;
    monitor.log('warn', `recebeu ${signal}: interrompendo o passo atual`);
    control.abort();
    killChildren();
    // se algo não responder ao cancelamento, sai assim mesmo
    setTimeout(() => {
      monitor.accountTime();
      monitor.close();
      process.exit(EXIT.interrupted);
    }, 10_000).unref();
  };
  process.on('SIGTERM', () => onSignal('SIGTERM'));
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGHUP', () => {});

  const values = {
    LOOP: name,
    TITULO: stage.title,
    PLANO: path.relative(root, paths.plan),
    ESCOPO: config.scope.length ? config.scope.map((p) => `\`${p}\``).join(', ') : '(nenhuma pasta de código)',
    ESCOPO_ARGS: config.scope.join(' ') || '.',
    VERIFICACOES: checksText({ config }),
    MOTOR: ENGINE_PATHS.map((p) => path.relative(root, p) || p).join('`, `'),
    LOOP_JSON: path.relative(root, paths.loop),
    NOME: stage.change,
    NUMERO: stage.number,
    TOTAL: state.loop.stages.length,
    FASE: stage.phase,
  };
  const ctx: IterationContext = {
    paths,
    state,
    config,
    plan,
    stage,
    dir,
    monitor,
    save,
    pauseRequested: () => readControl(paths).pause,
    signal: control.signal,
    system: buildSystem({ ...values, TITULO: state.loop.title }, plan.rules),
    forbidden: [
      ...GENERAL_FORBIDDEN_TOOLS,
      ...ENGINE_PATHS.flatMap((p) => [`Edit(/${p}/**)`, `Write(/${p}/**)`]),
      `Edit(/${paths.loop})`,
      `Write(/${paths.loop})`,
      ...config.forbiddenTools,
    ],
    values,
    outsideBefore: status(root, outsideScope(config.scope)),
  };

  const resumed = it0.currentStep > 0 || it0.steps.some((step) => step.attempts > 0);
  monitor.setIteration({
    iteration: it0.number,
    stage: stage.number,
    change: stage.change,
    title: it0.briefing?.title ?? stage.title,
  });
  monitor.startClock();
  monitor.event(resumed ? 'iteration_resumed' : 'iteration_start', {
    change: stage.change,
    step: stepLabel(steps[it0.currentStep]?.id ?? ''),
  });
  monitor.log(
    'info',
    `${resumed ? 'retomando' : 'iniciando'} a iteração ${it0.number}: etapa ${stage.number} de ${state.loop.stages.length} · ${stage.change}`,
  );

  const memory = () => Math.round(process.memoryUsage().rss / 1024 / 1024);
  const exit = (code: number, type: string, data: Record<string, unknown> = {}) => {
    // parou antes do commit da entrega: a sobra da proposta antecipada é apagada ao retomar
    ctx.early?.cancel();
    monitor.parallel(undefined);
    monitor.accountTime();
    monitor.event(type, { memoryMb: memory(), ...data });
    monitor.close();
    return code;
  };
  const current = () => {
    const iteration = state.loop.iteration;
    if (!iteration) throw new Error('nenhuma iteração em andamento');
    return iteration;
  };
  const stepRecord = (index: number) => {
    const record = current().steps[index];
    if (!record) throw new Error(`passo ${index} fora da iteração`);
    return record;
  };

  /** O passo terminou (pela execução ou por uma recuperação que cumpriu a pós-condição). */
  const finish = (index: number, result: void | 'skipped', start: number) => {
    const step = steps[index];
    const after = state.loop.iteration;
    const record = after?.steps[index];
    if (after && record) {
      record.state = result === 'skipped' ? 'skipped' : 'ok';
      record.detail = undefined;
      after.currentStep = index + 1;
      save();
    }
    monitor.event('step_end', {
      id: step?.id,
      state: result === 'skipped' ? 'skipped' : 'ok',
      durationMs: Date.now() - start,
      memoryMb: memory(),
    });
    monitor.log(
      'ok',
      `✔ ${stepLabel(step?.id ?? '')} em ${longDuration(Date.now() - start)}${result === 'skipped' ? ' (pulado)' : ''}`,
    );
    checkScope(ctx);
  };
  /** Para em `waiting`: a solução depende de uma pessoa. */
  const waitForHuman = (reason: string, whatToDo: string, report?: string) => {
    recordReason(reason, whatToDo);
    if (report && state.loop.lastRun) state.loop.lastRun.report = path.relative(root, report);
    save();
    monitor.log('warn', `⚑ aguardando uma pessoa: ${whatToDo}`);
    return exit(EXIT.waiting, 'waiting', { reason, whatToDo });
  };
  /** Falha registrada de vez: o loop para em `failed`. */
  const fail = (index: number, reason: string, report: string) => {
    const id = steps[index]?.id ?? '';
    state.loop.totals.failures++;
    recordReason(`passo ${index + 1} (${stepLabel(id)}) falhou: ${reason}`);
    if (state.loop.lastRun) state.loop.lastRun.report = path.relative(root, report);
    save();
    return exit(EXIT.failed, 'failure', { step: id, error: reason, report: path.relative(root, report) });
  };

  for (let index = current().currentStep; index < steps.length; index++) {
    const step = steps[index];
    if (!step) break;
    if (ctx.pauseRequested()) {
      monitor.log('warn', `pausado antes do passo ${index + 1} (${stepLabel(step.id)})`);
      return exit(EXIT.paused, 'pause', { beforeStep: step.id });
    }
    const maximum = config.limits.attemptsPerStep;
    for (let attempt = 1; ; attempt++) {
      const iteration = current();
      const record = stepRecord(index);
      iteration.currentStep = index;
      record.attempts++;
      record.state = 'running';
      record.detail = undefined;
      save();
      monitor.startStep(index);
      monitor.log(
        'step',
        `▸ ${index + 1}. ${stepLabel(step.id)}${attempt > 1 ? ` (execução ${attempt} de ${maximum})` : ''}`,
      );
      monitor.event('step_start', { attempt });
      const start = Date.now();
      try {
        const result = await step.execute(ctx);
        monitor.accountTime();
        finish(index, result, start);
        break;
      } catch (thrown) {
        monitor.accountTime();
        const error = thrown instanceof Error ? thrown : new Error(String(thrown));
        if (thrown instanceof Cancelled || control.signal.aborted) {
          stepRecord(index).state = 'pending';
          save();
          monitor.log('warn', 'interrompido; o passo em andamento será retomado ao continuar');
          return exit(EXIT.interrupted, 'interrupted', { step: step.id });
        }
        if (thrown instanceof PauseRequested) {
          stepRecord(index).state = 'pending';
          save();
          monitor.log('warn', `pausado no meio do passo ${stepLabel(step.id)}; ele continua de onde parou`);
          return exit(EXIT.paused, 'pause', { inStep: step.id });
        }
        const failed = stepRecord(index);
        failed.state = 'failed';
        failed.detail = error.message;
        save();
        monitor.log('error', `✖ ${stepLabel(step.id)} falhou: ${error.message}`);
        monitor.event('step_end', {
          id: step.id,
          state: 'failed',
          reason: error.message,
          durationMs: Date.now() - start,
        });
        const report = failureReport(paths, monitor, state.loop, current(), index, error, dir);

        const kind = classifyError(thrown);
        if (kind === 'engine') {
          // bug ou estado inválido do motor: nada de agente, segue como crash para o vigia
          monitor.log('error', `erro do motor (não recuperável): ${error.stack ?? error.message}`);
          monitor.accountTime();
          monitor.close();
          throw thrown;
        }
        if (kind === 'human') return waitForHuman(error.message, defaultWhatToDo(thrown), report);

        const signature = errorSignature(step.id, error.message);
        if (failed.recoveries?.some((r) => r.signature === signature)) {
          return fail(index, `mesmo erro depois da recuperação (${error.message})`, report);
        }
        const done = current().steps.reduce((n, s) => n + (s.recoveries?.length ?? 0), 0);
        if (done >= config.limits.recoveriesPerIteration) {
          return fail(
            index,
            `${error.message} (limite de ${config.limits.recoveriesPerIteration} recuperações da iteração atingido)`,
            report,
          );
        }
        if (ctx.pauseRequested()) return exit(EXIT.paused, 'pause', { inStep: step.id });

        let outcome: RecoveryOutcome;
        try {
          outcome = await recover(ctx, step, index, error, report, signature);
        } catch (recoveryFailure) {
          if (recoveryFailure instanceof Cancelled || control.signal.aborted) {
            stepRecord(index).state = 'pending';
            save();
            return exit(EXIT.interrupted, 'interrupted', { step: step.id });
          }
          throw recoveryFailure;
        }
        monitor.accountTime();
        if (outcome.outcome === 'human') return waitForHuman(outcome.reason, outcome.whatToDo, report);
        if (outcome.outcome === 'resolved') {
          finish(index, undefined, start);
          break;
        }
        if (attempt < maximum) {
          monitor.warn(
            `a recuperação não cumpriu o passo (${outcome.reason}); executando ${stepLabel(step.id)} de novo (${attempt + 1} de ${maximum})`,
          );
          continue;
        }
        return fail(
          index,
          `${error.message} (${maximum} execuções, recuperação sem sucesso: ${outcome.reason})`,
          report,
        );
      }
    }
  }

  if (state.loop.iteration) {
    // todos os passos rodaram, mas nenhum entregou a etapa (config sem commitDelivery)
    return exit(EXIT.failed, 'failure', { error: 'a iteração terminou sem entregar a etapa' });
  }
  monitor.log('ok', `etapa ${stage.number} entregue: ${stage.change}`);
  const code = nextStage(state.loop) ? EXIT.delivered : EXIT.done;
  return exit(code, 'iteration_end', { change: stage.change });
}

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('uso: iteration <nome-do-loop>');
    process.exit(EXIT.failed);
  }
  const crash = (error: unknown) => {
    console.error(
      'erro inesperado na iteração:',
      error instanceof Error ? (error.stack ?? error.message) : errorMessage(error),
    );
    killChildren();
    process.exit(EXIT.unexpected);
  };
  process.on('uncaughtException', crash);
  process.on('unhandledRejection', crash);
  const code = await runIteration(name);
  process.exit(code);
}

if (isEntry(fileURLToPath(import.meta.url))) void main();
