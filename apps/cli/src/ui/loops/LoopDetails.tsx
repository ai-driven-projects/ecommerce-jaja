import { Box, Text, useInput } from 'ink';
import path from 'node:path';
import { useEffect, useMemo, useState } from 'react';
import { readableCommand } from '../../loops/checks.js';
import { BASIC_COMMANDS, effectiveConfig, loopsRoot, stepLabel } from '../../loops/config.js';
import { readTail } from '../../loops/files.js';
import { clock, longDuration, money } from '../../loops/format.js';
import { short } from '../../loops/git.js';
import { loopPaths } from '../../loops/loops.js';
import {
  FILTER_LABEL,
  FILTERS,
  failuresFromEvents,
  type LogFilter,
  logLines,
  parseEvents,
  stepAverages,
  when,
} from '../../loops/presentation.js';
import { COLOR, SectionTitle } from './common.js';
import type { LoopState } from './useLoop.js';

const SECTIONS = ['Log', 'Claude', 'Histórico', 'Falhas', 'Configuração'] as const;
type Section = (typeof SECTIONS)[number];

/** Só o fim do eventos.jsonl é lido: o arquivo cresce sem limite. */
const LOG_BYTES = 512 * 1024;
const MAX_LOG_LINES = 4000;

/** Primeira linha visível de verdade: `null` (acompanhando) vira a última página. */
export const logStart = (start: number | null, total: number, height: number) => start ?? Math.max(0, total - height);

/** Rola o log em `step` linhas. Chegar ao fim volta a acompanhar (`null`), para o log seguir andando. */
export function scrollLog(start: number | null, step: number, total: number, height: number): number | null {
  const max = Math.max(0, total - height);
  const next = Math.min(max, Math.max(0, logStart(start, total, height) + step));
  return next >= max ? null : next;
}

interface Props {
  name: string;
  state: LoopState;
  height: number;
  onClose: () => void;
}

/** Os detalhes do loop, abertos por cima da tela principal com `d`; `esc` volta. */
export function LoopDetails({ name, state, height, onClose }: Props) {
  const [section, setSection] = useState<Section>('Log');
  const [filter, setFilter] = useState<LogFilter>('noOutput');
  const [start, setStart] = useState<number | null>(null);
  const paths = loopPaths(name);
  const alive = state.watcher !== null;
  const [rawLines, setRawLines] = useState<string[]>(() => readTail(paths.events, LOG_BYTES));

  useEffect(() => {
    if (!alive) return;
    const timer = setInterval(() => setRawLines(readTail(loopPaths(name).events, LOG_BYTES)), 1000);
    return () => clearInterval(timer);
  }, [name, alive]);
  const events = useMemo(() => parseEvents(rawLines), [rawLines]);
  const log = useMemo(() => logLines(events, filter).slice(-MAX_LOG_LINES), [events, filter]);
  const logHeight = Math.max(5, height - 6);

  useInput((input, key) => {
    if (key.escape) return onClose();
    const n = Number(input);
    const chosen = SECTIONS[n - 1];
    if (chosen) return setSection(chosen);
    if (key.tab)
      return setSection(
        (s) => SECTIONS[(SECTIONS.indexOf(s) + (key.shift ? SECTIONS.length - 1 : 1)) % SECTIONS.length] ?? 'Log',
      );
    if (section !== 'Log') return;
    if (input === 'f') {
      setStart(null);
      return setFilter((f) => FILTERS[(FILTERS.indexOf(f) + 1) % FILTERS.length] ?? 'all');
    }
    const scroll = (step: number) => setStart((s) => scrollLog(s, step, log.length, logHeight));
    if (key.upArrow || input === 'k') return scroll(-1);
    if (key.downArrow || input === 'j') return scroll(1);
    if (key.pageUp) return scroll(-logHeight);
    if (key.pageDown || input === ' ') return scroll(logHeight);
    if (input === 'g') return setStart(0);
    if (input === 'G') return setStart(null);
  });

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      borderStyle="round"
      borderColor={COLOR.dim}
      paddingX={1}
      overflow="hidden"
      height={height}
    >
      <Text wrap="truncate-end">
        <Text bold color={COLOR.accent}>
          Detalhes{'  '}
        </Text>
        {SECTIONS.map((s, index) => (
          <Text key={s} color={s === section ? COLOR.accent : COLOR.dim} bold={s === section} inverse={s === section}>
            {` ${index + 1} ${s} `}
          </Text>
        ))}
      </Text>
      {section === 'Log' && (
        <LogViewer
          lines={log}
          start={start}
          height={logHeight}
          title={`Log · ${FILTER_LABEL[filter]}`}
          file={path.relative(loopsRoot(), paths.events)}
          hint="↑↓ rola · pgup/pgdn página · g/G início/fim · f filtro · tab seção · esc volta"
        />
      )}
      {section === 'Claude' && <ClaudeSection state={state} height={height} />}
      {section === 'Histórico' && <HistorySection state={state} />}
      {section === 'Falhas' && <FailuresSection state={state} failures={failuresFromEvents(events)} />}
      {section === 'Configuração' && <ConfigSection name={name} state={state} />}
      {section !== 'Log' && (
        <Box flexGrow={1} alignItems="flex-end">
          <Text color={COLOR.dim}>1-5 ou tab troca a seção · esc volta</Text>
        </Box>
      )}
    </Box>
  );
}

function LogViewer({
  lines,
  start,
  height,
  file,
  title,
  hint,
}: {
  lines: string[];
  start: number | null;
  height: number;
  file: string;
  title: string;
  hint: string;
}) {
  const first = logStart(start, lines.length, height);
  const visible = lines.slice(first, first + height);
  const end = Math.min(first + height, lines.length);
  return (
    <Box flexDirection="column" flexShrink={0}>
      <Box justifyContent="space-between">
        <Text wrap="truncate-end">
          <Text bold color={COLOR.accent}>
            {title}
          </Text>
          <Text color={COLOR.dim}> {file}</Text>
        </Text>
        <Text color={start === null ? COLOR.success : COLOR.dim}>
          {start === null ? 'acompanhando o fim' : 'parado'}
        </Text>
      </Box>
      <Box flexDirection="column" height={height} overflow="hidden">
        {visible.length === 0 ? (
          <Text color={COLOR.dim}>nada ainda</Text>
        ) : (
          visible.map((line, index) => (
            <Text
              key={first + index}
              color={line.includes('▸') || line.includes('✔') ? undefined : COLOR.dim}
              wrap="truncate-end"
            >
              {line || ' '}
            </Text>
          ))
        )}
      </Box>
      <Box justifyContent="space-between">
        <Text color={COLOR.dim}>{hint}</Text>
        <Text color={COLOR.dim}>{lines.length > height ? `${first + 1}–${end} de ${lines.length}` : ''}</Text>
      </Box>
    </Box>
  );
}

function ClaudeSection({ state, height }: { state: LoopState; height: number }) {
  const { live } = state;
  if (!live)
    return (
      <Text color={COLOR.dim}>
        O loop não está rodando agora. As sessões de cada iteração ficam em .execucao/iteracao-NN/*.jsonl.
      </Text>
    );
  const activities = live.activities.slice(-Math.max(3, height - 14));
  return (
    <Box flexDirection="column" marginTop={1}>
      <SectionTitle>{live.currentSession ? `Sessão atual · ${live.currentSession}` : 'Últimas ações'}</SectionTitle>
      {activities.length === 0 && <Text color={COLOR.dim}>nada ainda</Text>}
      {activities.map((activity, index) => (
        <Text key={index} wrap="truncate-end" color={activity.kind === 'text' ? undefined : COLOR.dim}>
          {clock(activity.ts)} {activity.kind === 'tool' ? '→' : '💬'} {activity.text}
        </Text>
      ))}
      <Box marginTop={1} flexDirection="column">
        <SectionTitle>Sessões desta iteração</SectionTitle>
        {live.sessions.slice(-8).map((session, index) => (
          <Text key={index} wrap="truncate-end">
            <Text color={session.ok ? COLOR.success : COLOR.error}>{session.ok ? '✔' : '✖'}</Text>{' '}
            {session.label.padEnd(24)}
            <Text color={COLOR.dim}>
              {longDuration(session.durationMs).padStart(7)} {money(session.cost).padStart(10)}{' '}
              {String(session.turns).padStart(4)} turnos
              {session.attempt > 1 ? ` · tentativa ${session.attempt}` : ''}
              {session.error ? ` · ${session.error}` : ''}
            </Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
}

function HistorySection({ state }: { state: LoopState }) {
  const loop = state.loop;
  if (!loop) return null;
  const delivered = loop.stages.filter((stage) => stage.status === 'delivered');
  const averages = stepAverages(delivered);
  const t = loop.totals;
  return (
    <Box flexDirection="column" marginTop={1}>
      <SectionTitle>{`Etapas entregues (${delivered.length})`}</SectionTitle>
      {delivered.length === 0 && <Text color={COLOR.dim}>nenhuma ainda</Text>}
      {delivered.slice(-10).map((stage) => (
        <Text key={stage.number} wrap="truncate-end">
          <Text color={COLOR.success}>✔</Text> {String(stage.number).padStart(2, '0')} {stage.change.padEnd(40)}
          <Text color={COLOR.dim}>
            {stage.commit ? short(stage.commit) : 'fora do loop'}
            {stage.durationMs ? `  ${longDuration(stage.durationMs)}` : ''}
            {stage.cost ? `  ${money(stage.cost)}` : ''}
            {stage.deliveredAt ? `  ${when(stage.deliveredAt)}` : ''}
          </Text>
        </Text>
      ))}
      <Box marginTop={1} flexDirection="column">
        <SectionTitle>Médias por passo</SectionTitle>
        {averages.length === 0 && <Text color={COLOR.dim}>aparecem depois da primeira entrega do loop</Text>}
        {averages.map((average) => (
          <Text key={average.id}>
            {average.label.padEnd(28)}
            <Text color={COLOR.dim}>
              {longDuration(average.averageMs).padStart(8)} {money(average.averageCost).padStart(10)}
            </Text>
          </Text>
        ))}
        <Text color={COLOR.dim} wrap="wrap">
          {t.iterationsDelivered} entregas · {t.claudeSessions} sessões do Claude · {t.turns} turnos · {t.checks}{' '}
          verificações · {t.fixes} correções · {t.commits} commits
        </Text>
      </Box>
    </Box>
  );
}

function FailuresSection({ state, failures }: { state: LoopState; failures: ReturnType<typeof failuresFromEvents> }) {
  const loop = state.loop;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color={COLOR.dim} wrap="wrap">
        {loop?.totals.failures ?? 0} falha(s) registrada(s) · {loop?.totals.recoveries ?? 0} recuperação(ões),{' '}
        {loop?.totals.recoveriesResolved ?? 0} resolvida(s) · {loop?.totals.restarts ?? 0} reinício(s) por crash
      </Text>
      {loop?.lastRun?.reason && (
        <Box marginTop={1} flexDirection="column">
          <SectionTitle>Última execução</SectionTitle>
          <Text wrap="truncate-end">
            {loop.lastRun.outcome ?? 'em andamento'} · {when(loop.lastRun.end ?? loop.lastRun.start)}
          </Text>
          <Text color={COLOR.error} wrap="wrap">
            {loop.lastRun.reason}
          </Text>
        </Box>
      )}
      <RecoveriesSection state={state} />
      <Box marginTop={1} flexDirection="column">
        <SectionTitle>Últimas falhas</SectionTitle>
        {failures.length === 0 && <Text color={COLOR.dim}>nenhuma no log recente</Text>}
        {failures.map((failure, index) => (
          <Box key={index} flexDirection="column">
            <Text wrap="truncate-end">
              <Text color={COLOR.error}>✖</Text> {when(failure.ts)}
              {failure.step ? ` · ${stepLabel(failure.step)}` : ''} · {failure.error}
            </Text>
            {failure.report && <Text color={COLOR.dim}> {failure.report}</Text>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function RecoveriesSection({ state }: { state: LoopState }) {
  const iteration = state.loop?.iteration;
  const recoveries = (iteration?.steps ?? []).flatMap((step) =>
    (step.recoveries ?? []).map((recovery) => ({ ...recovery, step: step.id })),
  );
  return (
    <Box marginTop={1} flexDirection="column">
      <SectionTitle>{`Recuperações desta iteração (${recoveries.length})`}</SectionTitle>
      {recoveries.length === 0 && <Text color={COLOR.dim}>nenhuma</Text>}
      {recoveries.slice(-6).map((recovery, index) => (
        <Box key={index} flexDirection="column">
          <Text wrap="truncate-end">
            <Text color={recovery.refused ? COLOR.error : recovery.resolved ? COLOR.success : COLOR.warn}>
              {recovery.refused
                ? '✖ recusada'
                : recovery.needsHuman
                  ? '⚑ pediu uma pessoa'
                  : recovery.resolved
                    ? '✔ resolveu'
                    : '↻ não resolveu'}
            </Text>{' '}
            {stepLabel(recovery.step)} · {recovery.error}
          </Text>
          {recovery.cause && (
            <Text color={COLOR.dim} wrap="truncate-end">
              {'   '}causa: {recovery.cause}
            </Text>
          )}
          {recovery.whatItDid && (
            <Text color={COLOR.dim} wrap="truncate-end">
              {'   '}fez: {recovery.whatItDid}
            </Text>
          )}
          {recovery.refused?.slice(0, 3).map((line) => (
            <Text key={line} color={COLOR.error} wrap="truncate-end">
              {'   '}
              {line}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
}

function ConfigSection({ name, state }: { name: string; state: LoopState }) {
  if (!state.loop) return null;
  const config = effectiveConfig(state.loop.config);
  const paths = loopPaths(name);
  const relative = (p: string) => path.relative(loopsRoot(), p);
  const field = (label: string, value: string) => (
    <Text wrap="truncate-end">
      <Text color={COLOR.dim}>{label.padEnd(16)}</Text>
      {value}
    </Text>
  );
  const l = config.limits;
  return (
    <Box flexDirection="column" marginTop={1}>
      {field('Modelo', config.model || 'padrão do Claude Code')}
      {field('Escopo', config.scope.join(', ') || '(nenhum)')}
      {field('Commit', `${config.commitPrefix}: …`)}
      {field('Comandos', [...BASIC_COMMANDS, ...config.requiredCommands].join(', '))}
      {field('Passos', config.steps.map(stepLabel).join(' → '))}
      {field(
        'Limites',
        `${l.iterationsPerRun} iterações/execução · ${l.attemptsPerStep} execuções/passo · ${l.recoveriesPerIteration} recuperações/iteração · ${l.fixes} correções · ${l.continuations} continuações`,
      )}
      {field(
        '',
        `${l.tasksPerSession} tarefas/sessão · ${l.restarts} reinícios · sessão ${l.sessionMin} min (parada ${l.sessionIdleMin} min) · comando ${l.commandMin} min`,
      )}
      {field('Proibições', config.forbiddenTools.join(', ') || '(só as gerais)')}
      {field('Verificações', config.checks.length ? '' : '(nenhuma)')}
      {config.checks.map((check) => (
        <Text key={check.id} color={COLOR.dim} wrap="truncate-end">
          {'   '}
          {readableCommand(check)}
        </Text>
      ))}
      {field('Plano', relative(paths.plan))}
      {field('Controle', relative(paths.loop))}
      {field('Execução', `${relative(paths.run)}/ (fora do git)`)}
    </Box>
  );
}
