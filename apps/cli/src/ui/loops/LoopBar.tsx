import { Box, Text } from 'ink';
import { longDuration, money } from '../../loops/format.js';
import { deliveredStages } from '../../loops/loops.js';
import { liveTime, STATUS_COLOR, STATUS_ICON, STATUS_LABEL } from '../../loops/presentation.js';
import type { Live, Loop, LoopStatus } from '../../loops/types.js';
import { COLOR } from './common.js';

interface Props {
  loop: Loop;
  status: LoopStatus;
  live?: Live;
  alive: boolean;
  pauseRequested: boolean;
  branch: string;
  now: number;
  totalStages: number;
}

/** Topo da tela do loop: nome, status e os totais acumulados de todas as execuções. */
export function LoopBar({ loop, status, live, alive, pauseRequested, branch, now, totalStages }: Props) {
  const totals = loop.totals;
  const time = liveTime(totals.durationMs, live?.accountedUntil, alive, now);
  const separator = <Text color={COLOR.dim}> · </Text>;
  return (
    <Box borderStyle="round" borderColor={COLOR.accent} paddingX={1} flexShrink={0} justifyContent="space-between">
      {/* o nome e o status não encolhem: quem corta, se faltar espaço, são os totais */}
      <Box flexShrink={0} marginRight={2}>
        <Text>
          <Text bold color={COLOR.accent}>
            {loop.title}
          </Text>
          <Text color={COLOR.dim}> {loop.name}</Text>
          {'  '}
          <Text color={STATUS_COLOR[status]} bold>
            {STATUS_ICON[status]} {STATUS_LABEL[status]}
          </Text>
          {pauseRequested && status === 'running' && <Text color={COLOR.warn}> (pausa pedida)</Text>}
        </Text>
      </Box>
      <Text wrap="truncate-end">
        <Text color={COLOR.dim}>etapas </Text>
        <Text bold>
          {deliveredStages(loop)}/{totalStages}
        </Text>
        {loop.iteration && (
          <>
            {separator}
            <Text color={COLOR.dim}>iteração </Text>
            {loop.iteration.number}
          </>
        )}
        {separator}⏱ <Text bold>{longDuration(time)}</Text>
        {separator}
        <Text bold>{money(totals.cost)}</Text>
        {separator}
        {totals.runs} exec.
        {totals.restarts > 0 && (
          <>
            {separator}
            <Text color={COLOR.warn}>{totals.restarts} reinício(s)</Text>
          </>
        )}
        {branch && (
          <>
            {separator}
            <Text color="cyan">{branch}</Text>
          </>
        )}
      </Text>
    </Box>
  );
}
