import { Box, Text, useInput, useWindowSize } from 'ink';
import { useState } from 'react';
import { stepLabel } from '../../loops/config.js';
import { readControl } from '../../loops/control.js';
import { readJson } from '../../loops/files.js';
import { longDuration, money } from '../../loops/format.js';
import { currentBranch } from '../../loops/git.js';
import { deliveredStages, type LoopListItem } from '../../loops/loops.js';
import {
  liveTime,
  scrollWindow,
  sortLoops,
  STATUS_COLOR,
  STATUS_ICON,
  STATUS_LABEL,
  statusActions,
  when,
} from '../../loops/presentation.js';
import type { Live } from '../../loops/types.js';
import { COLOR, Keys, Messages, SectionTitle, YesNo } from './common.js';
import { LoopScreen } from './LoopScreen.js';
import { NewLoopScreen } from './NewLoopScreen.js';
import { useLoopList, useNow } from './useLoop.js';
import { confirmationQuestion, useLoopActions } from './useLoopActions.js';

/** Linhas do cabeçalho do CLI (borda, nome e pasta), que fica acima das telas. */
const HEADER_ROWS = 4;
/** Linhas fora da lista: título (2), margem, contagem, mensagens (até 3), teclas e folga. */
const LIST_CHROME_ROWS = 10;

type View = { kind: 'list' } | { kind: 'loop'; name: string } | { kind: 'new' };

interface Props {
  rootDir: string;
  /** `new` abre direto o planejamento de um loop novo (comando `loops:new`). */
  initial?: 'list' | 'new';
  onExit: () => void;
}

function readBranch(rootDir: string): string {
  try {
    return currentBranch(rootDir);
  } catch {
    return '';
  }
}

/** Os loops do projeto, com o básico de cada um; enter abre a tela do loop, n planeja um novo. */
export function LoopsScreen({ rootDir, initial = 'list', onExit }: Props) {
  const [view, setView] = useState<View>(initial === 'new' ? { kind: 'new' } : { kind: 'list' });
  const [items, reread] = useLoopList();
  const [selected, setSelected] = useState(0);
  const [branch] = useState(() => readBranch(rootDir));
  const { rows } = useWindowSize();
  const now = useNow(1000);
  const actions = useLoopActions(reread);
  const list = sortLoops(items);
  const position = Math.min(selected, list.length - 1);
  const current = list[position];
  const pauseRequested = (item?: LoopListItem) => (item ? readControl(item.paths).pause : false);
  const available = current?.status
    ? statusActions(current.status, { divergent: false, pauseRequested: pauseRequested(current) })
    : [];
  const screenRows = Math.max(12, rows - HEADER_ROWS - 1);

  useInput(
    (input, key) => {
      if (key.escape) return onExit();
      if (key.upArrow) return setSelected(list.length ? (position - 1 + list.length) % list.length : 0);
      if (key.downArrow || key.tab) return setSelected(list.length ? (position + 1) % list.length : 0);
      if (input === 'n') return setView({ kind: 'new' });
      if (!current) return;
      if (key.return) {
        actions.clear();
        return setView({ kind: 'loop', name: current.name });
      }
      if (available.some((action) => action.key === input))
        actions.execute(input, current.name, { pauseRequested: pauseRequested(current) });
    },
    { isActive: view.kind === 'list' && !actions.confirmation },
  );

  if (view.kind === 'loop') {
    return (
      <LoopScreen
        name={view.name}
        branch={branch}
        rows={screenRows}
        onBack={() => {
          setView({ kind: 'list' });
          reread();
        }}
      />
    );
  }
  if (view.kind === 'new') {
    return (
      <NewLoopScreen
        onExit={() => (initial === 'new' ? onExit() : setView({ kind: 'list' }))}
        onCreated={(name) => {
          reread();
          setView({ kind: 'loop', name });
        }}
      />
    );
  }

  const nameWidth = Math.max(10, ...list.map((item) => item.name.length)) + 2;
  const { start, end } = scrollWindow(list.length, Math.max(0, position), Math.max(3, screenRows - LIST_CHROME_ROWS));
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text bold color={COLOR.accent}>
        Loops de desenvolvimento
      </Text>
      <Text color={COLOR.dim}>openspec/loops · uma change OpenSpec por etapa, em segundo plano</Text>
      <Box flexDirection="column" marginTop={1}>
        {list.length === 0 && (
          <Box flexDirection="column">
            <Text>nenhum loop ainda.</Text>
            <Text color={COLOR.dim}>aperte n para planejar o primeiro (ou use &quot;Novo loop&quot; na busca).</Text>
          </Box>
        )}
        {list.length > 0 && <SectionTitle>{`${list.length} loop(s)`}</SectionTitle>}
        {start > 0 && <Text color={COLOR.dim}>↑ {start} acima</Text>}
        {list.slice(start, end).map((item) => (
          <LoopRow key={item.name} item={item} active={item === current} nameWidth={nameWidth} now={now} />
        ))}
        {end < list.length && <Text color={COLOR.dim}>↓ {list.length - end} abaixo</Text>}
      </Box>
      <Box marginTop={1} flexDirection="column" flexShrink={0}>
        {actions.confirmation ? (
          <YesNo question={confirmationQuestion(actions.confirmation)} onYes={actions.confirm} onNo={actions.cancel} />
        ) : (
          <>
            <Messages messages={actions.messages} max={3} />
            <Keys
              actions={available}
              extras={[
                ...(current ? [{ key: 'enter', label: 'abre' }] : []),
                { key: 'n', label: 'novo loop' },
                { key: 'esc', label: 'volta' },
              ]}
            />
          </>
        )}
      </Box>
    </Box>
  );
}

function LoopRow({
  item,
  active,
  nameWidth,
  now,
}: {
  item: LoopListItem;
  active: boolean;
  nameWidth: number;
  now: number;
}) {
  const pointer = <Text color={COLOR.accent}>{active ? '› ' : '  '}</Text>;
  if (!item.loop || !item.status) {
    return (
      <Text wrap="truncate-end">
        {pointer}
        <Text bold={active}>{item.name.padEnd(nameWidth)}</Text>
        <Text color={COLOR.error}>{item.error}</Text>
      </Text>
    );
  }
  const { loop, status } = item;
  const read = item.watcher ? readJson<Live>(item.paths.live) : undefined;
  const live = read?.ok ? read.value : undefined;
  const time = liveTime(loop.totals.durationMs, live?.accountedUntil, item.watcher !== null, now);
  const stage = loop.iteration ? loop.stages.find((s) => s.number === loop.iteration?.stage) : undefined;
  const step = loop.iteration?.steps[loop.iteration.currentStep];
  const total = status === 'draft' ? '—' : `${deliveredStages(loop)}/${loop.stages.length}`;
  return (
    <Text wrap="truncate-end">
      {pointer}
      <Text bold={active} color={active ? COLOR.accent : undefined}>
        {item.name.padEnd(nameWidth)}
      </Text>
      <Text color={STATUS_COLOR[status]}>{`${STATUS_ICON[status]} ${STATUS_LABEL[status]}`.padEnd(15)}</Text>
      <Text>{total.padStart(6)} etapas </Text>
      <Text color={COLOR.dim}>
        {longDuration(time).padStart(8)}
        {money(loop.totals.cost).padStart(11)}
        {`${loop.totals.runs} exec.`.padStart(9)}
        {`  ${when(loop.lastRun?.end ?? loop.lastRun?.start, now)}`.padEnd(14)}
      </Text>
      {status === 'waiting' && loop.lastRun?.whatToDo && <Text color="magenta"> {loop.lastRun.whatToDo}</Text>}
      {stage && status !== 'waiting' && (
        <Text color={COLOR.dim}>
          {' '}
          etapa {stage.number} · {step ? stepLabel(step.id).toLowerCase() : ''}
        </Text>
      )}
    </Text>
  );
}
