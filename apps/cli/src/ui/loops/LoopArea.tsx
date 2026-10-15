import { Box, Text } from 'ink';
import { readableCommand } from '../../loops/checks.js';
import { BASIC_COMMANDS, effectiveConfig, loopsRoot, stepLabel } from '../../loops/config.js';
import { longDuration, money, oneLine } from '../../loops/format.js';
import { deliveredStages, nextStage } from '../../loops/loops.js';
import { changeExists } from '../../loops/openspec.js';
import { planStages, validatePlan } from '../../loops/plan.js';
import { iterationProgress, phaseProgress, recoveryMark, STATE_COLOR, STATE_MARK } from '../../loops/presentation.js';
import { Bar, Busy, COLOR, SectionTitle } from './common.js';
import type { LoopState } from './useLoop.js';

interface Props {
  state: LoopState;
  now: number;
  width: number;
  compact: boolean;
}

/** A área principal: progresso geral, a iteração atual e os passos dela, e o que acontece agora. */
export function LoopArea({ state, now, width, compact }: Props) {
  const { loop, live, status } = state;
  if (!loop || !status) return null;
  const alive = state.watcher !== null;
  const iteration = loop.iteration;
  const stage = iteration ? loop.stages.find((s) => s.number === iteration.stage) : nextStage(loop);
  const delivered = deliveredStages(loop);
  const barWidth = Math.max(10, Math.min(40, width - 30));
  const currentStep = iteration?.steps[iteration.currentStep];
  const liveInStep = (index: number) => alive && iteration?.currentStep === index && live?.step === index;
  const stepTime = (index: number, ms: number) =>
    liveInStep(index) && live ? ms + Math.max(0, now - live.accountedUntil) : ms;
  const iterationTime = iteration
    ? iteration.steps.reduce((sum, step, index) => sum + stepTime(index, step.durationMs), 0)
    : 0;
  const iterationCost = iteration ? iteration.steps.reduce((sum, step) => sum + step.cost, 0) : 0;
  const active =
    live?.items.filter((item) => item.state === 'running' || item.state === 'failed' || item.state === 'warn') ?? [];
  const lastActivity = live?.activities.at(-1);
  const progress = iteration ? iterationProgress(iteration) : undefined;

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      <SectionTitle>Progresso geral</SectionTitle>
      <Text>
        <Bar done={delivered} total={loop.stages.length} width={barWidth} color={COLOR.success} />{' '}
        <Text bold>
          {delivered}/{loop.stages.length}
        </Text>
        <Text color={COLOR.dim}> etapas entregues</Text>
      </Text>
      {!compact && (
        <Text color={COLOR.dim} wrap="truncate-end">
          {phaseProgress(loop.stages)
            .map((phase) => `${phase.name} ${phase.delivered}/${phase.total}`)
            .join('  ·  ')}
        </Text>
      )}

      <Box marginTop={1} flexDirection="column">
        <SectionTitle>{iteration ? `Iteração ${iteration.number}` : 'Próxima iteração'}</SectionTitle>
        {iteration && stage && progress ? (
          <>
            <Text wrap="truncate-end">
              <Text bold>
                Etapa {stage.number} de {loop.stages.length}
              </Text>
              <Text color={COLOR.dim}> · {stage.change}</Text>
            </Text>
            <Text wrap="truncate-end">{iteration.briefing?.title ?? stage.title}</Text>
            <Text>
              <Bar done={progress.done} total={progress.total} width={barWidth} />{' '}
              <Text bold>
                {progress.done}/{progress.total}
              </Text>
              <Text color={COLOR.dim}>
                {' '}
                passos · ⏱ {longDuration(iterationTime)} · {money(iterationCost)}
              </Text>
            </Text>
          </>
        ) : stage ? (
          <Text wrap="truncate-end">
            etapa {stage.number} de {loop.stages.length} · <Text bold>{stage.title}</Text>
            <Text color={COLOR.dim}> · {stage.change}</Text>
          </Text>
        ) : (
          <Text color={COLOR.success}>Todas as etapas do plano foram entregues.</Text>
        )}
      </Box>

      {iteration && (
        <Box marginTop={1} flexDirection="column">
          <SectionTitle>Passos</SectionTitle>
          {iteration.steps.map((step, index) => {
            const mark = recoveryMark(step);
            return (
              <Text key={step.id} wrap="truncate-end" color={step.state === 'pending' ? COLOR.dim : undefined}>
                {liveInStep(index) ? <Busy /> : <Text color={STATE_COLOR[step.state]}>{STATE_MARK[step.state]}</Text>}
                <Text bold={index === iteration.currentStep}>{` ${index + 1}. ${stepLabel(step.id)}`.padEnd(31)}</Text>
                <Text color={COLOR.dim}>
                  {step.durationMs || liveInStep(index)
                    ? longDuration(stepTime(index, step.durationMs)).padStart(8)
                    : ''.padStart(8)}
                  {step.cost ? `  ${money(step.cost)}` : ''}
                  {step.attempts > 1 ? `  ×${step.attempts}` : ''}
                </Text>
                {mark && <Text color={mark.resolved ? COLOR.success : COLOR.warn}>{`  ${mark.text}`}</Text>}
                {step.state === 'failed' && step.detail && (
                  <Text color={COLOR.error}>{`  ${oneLine(step.detail, 80)}`}</Text>
                )}
              </Text>
            );
          })}
        </Box>
      )}

      {alive && live && (
        <Box marginTop={1} flexDirection="column">
          <SectionTitle>Agora</SectionTitle>
          {live.waiting && <Text color={COLOR.warn}>⏳ {live.waiting}</Text>}
          {live.parallel && (
            <Text color={COLOR.dim} wrap="truncate-end">
              ⇉ em paralelo: {live.parallel}
            </Text>
          )}
          {currentStep?.id === 'apply' && live.tasks && (
            <Text>
              <Bar done={live.tasks.done} total={live.tasks.total} width={barWidth} color="cyan" />{' '}
              <Text bold>
                {live.tasks.done}/{live.tasks.total}
              </Text>
              <Text color={COLOR.dim}> tarefas do tasks.md</Text>
            </Text>
          )}
          {active.slice(-(compact ? 2 : 4)).map((item) => (
            <Text key={item.id} wrap="truncate-end">
              <Text color={STATE_COLOR[item.state]}>{STATE_MARK[item.state]}</Text> {item.label}
              {item.detail && <Text color={COLOR.dim}> · {item.detail}</Text>}
            </Text>
          ))}
          {lastActivity && (
            <Text color={COLOR.dim} wrap="truncate-end">
              {lastActivity.kind === 'tool' ? '→ ' : '💬 '}
              {lastActivity.text}
            </Text>
          )}
        </Box>
      )}

      {live?.warning && alive && (
        <Text color={COLOR.warn} wrap="truncate-end">
          ! {live.warning}
        </Text>
      )}
      {!alive && status === 'waiting' && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
          <Text bold color="magenta">
            ⚑ O loop precisa de você
          </Text>
          {loop.lastRun?.reason && <Text wrap="wrap">{loop.lastRun.reason}</Text>}
          <Text wrap="wrap">
            <Text bold>O que fazer: </Text>
            {loop.lastRun?.whatToDo ?? 'veja os detalhes (d)'}
          </Text>
          <Text color={COLOR.dim}>depois, i continua do passo em que parou</Text>
        </Box>
      )}
      {!alive && loop.lastRun?.reason && status !== 'pending' && status !== 'waiting' && (
        <Box marginTop={1} flexDirection="column">
          <Text color={status === 'failed' ? COLOR.error : COLOR.warn} wrap="truncate-end">
            {status === 'failed' ? '✖ ' : ''}
            {loop.lastRun.reason}
          </Text>
          {loop.lastRun.report && (
            <Text color={COLOR.dim} wrap="truncate-end">
              relatório: {loop.lastRun.report}
            </Text>
          )}
          {status === 'interrupted' && iteration && (
            <Text color={COLOR.dim}>o passo {iteration.currentStep + 1} é retomado ao continuar</Text>
          )}
        </Box>
      )}
      {state.divergences.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text color={COLOR.warn}>o plano.md mudou desde a aprovação: aprove de novo para continuar</Text>
          {state.divergences.slice(0, 4).map((divergence) => (
            <Text key={divergence} color={COLOR.dim} wrap="truncate-end">
              · {divergence}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

/** Rascunho: o resumo do plano gerado e da configuração sugerida, para aprovar, editar ou descartar. */
export function DraftSummary({ state, showStages }: { state: LoopState; showStages: boolean }) {
  const { loop, plan } = state;
  if (!loop) return null;
  const config = effectiveConfig(loop.config);
  const problems = plan
    ? validatePlan(plan, loop.name, (change) => changeExists(loopsRoot(), change))
    : ['plano.md não encontrado'];
  const field = (label: string, value: string) => (
    <Text wrap="truncate-end">
      <Text color={COLOR.dim}>{label.padEnd(14)}</Text>
      {value}
    </Text>
  );
  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      <SectionTitle>Rascunho do plano</SectionTitle>
      <Text color={COLOR.dim}>
        Revise as etapas{showStages ? '' : ' ao lado'} e a configuração. Ajuste o plano.md se precisar e aprove.
      </Text>
      {showStages && plan && (
        <Box marginTop={1} flexDirection="column">
          <SectionTitle>Etapas</SectionTitle>
          {planStages(plan).map((stage) => (
            <Text key={stage.number} wrap="truncate-end">
              {String(stage.number).padStart(2, '0')} {stage.title}
              <Text color={COLOR.dim}> · {stage.readySpec ? `spec pronta ${stage.change}` : stage.phase}</Text>
            </Text>
          ))}
        </Box>
      )}
      {plan?.goal && (
        <Box marginTop={1} flexDirection="column">
          <SectionTitle>Objetivo</SectionTitle>
          {plan.goal
            .split('\n')
            .slice(0, 4)
            .map((line, index) => (
              <Text key={index} wrap="truncate-end">
                {line || ' '}
              </Text>
            ))}
        </Box>
      )}
      <Box marginTop={1} flexDirection="column">
        <SectionTitle>Configuração</SectionTitle>
        {field('Escopo', config.scope.join(', ') || '(nenhuma pasta: só arquivos OpenSpec)')}
        {field('Commit', `${config.commitPrefix}: …`)}
        {field('Comandos', [...BASIC_COMMANDS, ...config.requiredCommands].join(', '))}
        {field('Passos', `${config.steps.length} por iteração`)}
        {field('Verificações', config.checks.length ? '' : '(nenhuma)')}
        {config.checks.map((check) => (
          <Text key={check.id} color={COLOR.dim} wrap="truncate-end">
            {'   '}
            {readableCommand(check)}
          </Text>
        ))}
        {field('Arquivos', `openspec/loops/${loop.name}/plano.md e loop.json`)}
      </Box>
      {problems.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {problems.slice(0, 5).map((problem) => (
            <Text key={problem} color={COLOR.error} wrap="truncate-end">
              ✖ {problem}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
