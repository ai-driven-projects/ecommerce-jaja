import { Box, Text, useInput, useWindowSize } from 'ink';
import { useState } from 'react';
import { planStages } from '../../loops/plan.js';
import { statusActions } from '../../loops/presentation.js';
import type { LoopStage } from '../../loops/types.js';
import { COLOR, Keys, Messages, YesNo } from './common.js';
import { DraftSummary, LoopArea } from './LoopArea.js';
import { LoopBar } from './LoopBar.js';
import { LoopDetails } from './LoopDetails.js';
import { PhaseSummary, StagesSidebar } from './StagesSidebar.js';
import { useLoopState, useNow } from './useLoop.js';
import { confirmationQuestion, useLoopActions } from './useLoopActions.js';

/** Abaixo disso a lateral vira uma linha de resumo por fase. */
const COLUMNS_FOR_SIDEBAR = 100;
const SIDEBAR_WIDTH = 36;
/** Linhas fora do corpo: barra do loop (3), mensagens (até 3) e teclas (1). */
const CHROME_ROWS = 7;

interface Props {
  name: string;
  branch: string;
  /** Linhas disponíveis para a tela (o terminal menos o cabeçalho do CLI). */
  rows: number;
  onBack: () => void;
}

/**
 * A tela de um loop. Só lê os arquivos que o vigia grava: abrir, fechar ou sair
 * do CLI nunca afeta o loop em execução.
 */
export function LoopScreen({ name, branch, rows, onBack }: Props) {
  const [state, reread] = useLoopState(name);
  const [details, setDetails] = useState(false);
  const now = useNow(1000);
  const { columns } = useWindowSize();
  const actions = useLoopActions(reread, () => onBack());
  const { loop, status } = state;
  const pauseRequested = state.control.pause;
  const available = status ? statusActions(status, { divergent: state.divergences.length > 0, pauseRequested }) : [];

  useInput(
    (input, key) => {
      if (key.escape) return onBack();
      if (input === 'd' && loop) {
        actions.clear();
        return setDetails(true);
      }
      if (input === 'r') return reread();
      if (!available.some((action) => action.key === input)) return;
      actions.execute(input, name, { pauseRequested });
    },
    { isActive: !details && !actions.confirmation },
  );

  if (!loop || !status) {
    return (
      <Box flexDirection="column">
        <Text color={COLOR.error}>
          {name}: {state.error ?? 'carregando…'}
        </Text>
        <Text color={COLOR.dim}>esc volta</Text>
      </Box>
    );
  }

  // no rascunho as etapas ainda não foram aprovadas: a lateral mostra as do plano
  const stages: LoopStage[] =
    status === 'draft' && state.plan
      ? planStages(state.plan).map((stage) => ({ ...stage, status: 'pending' as const }))
      : loop.stages;
  const alive = state.watcher !== null;
  const wide = columns >= COLUMNS_FOR_SIDEBAR;
  const bodyHeight = Math.max(8, rows - CHROME_ROWS);
  const areaWidth = columns - (wide ? SIDEBAR_WIDTH + 4 : 4);

  return (
    <Box flexDirection="column">
      <LoopBar
        loop={loop}
        status={status}
        live={state.live}
        alive={alive}
        pauseRequested={pauseRequested}
        branch={branch}
        now={now}
        totalStages={stages.length}
      />
      {details ? (
        <LoopDetails name={name} state={state} height={bodyHeight} onClose={() => setDetails(false)} />
      ) : (
        <Box flexDirection={wide ? 'row' : 'column'} height={bodyHeight} overflow="hidden">
          {wide ? (
            <StagesSidebar
              loop={loop}
              status={status}
              stages={stages}
              alive={alive}
              height={bodyHeight}
              width={SIDEBAR_WIDTH}
            />
          ) : (
            <PhaseSummary stages={stages} />
          )}
          <Box flexDirection="column" flexGrow={1} paddingLeft={wide ? 1 : 0} marginTop={wide ? 0 : 1}>
            {status === 'draft' ? (
              <DraftSummary state={state} showStages={!wide} />
            ) : (
              <LoopArea state={state} now={now} width={areaWidth} compact={!wide} />
            )}
          </Box>
        </Box>
      )}
      {actions.confirmation ? (
        <YesNo question={confirmationQuestion(actions.confirmation)} onYes={actions.confirm} onNo={actions.cancel} />
      ) : (
        !details && (
          <Box flexDirection="column" flexShrink={0}>
            <Messages messages={actions.messages} max={3} />
            <Keys
              actions={available}
              extras={[
                { key: 'd', label: 'detalhes' },
                { key: 'esc', label: 'volta à lista' },
              ]}
            />
          </Box>
        )
      )}
    </Box>
  );
}
