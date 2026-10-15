import { Box, Text } from 'ink';
import { phaseSummary, scrollWindow, sidebarLines, STAGE_COLOR, STAGE_MARK } from '../../loops/presentation.js';
import type { Loop, LoopStage, LoopStatus } from '../../loops/types.js';
import { Busy, COLOR } from './common.js';

interface Props {
  loop: Loop;
  status: LoopStatus;
  stages: LoopStage[];
  alive: boolean;
  height: number;
  width: number;
}

/** As fases e etapas do loop, como o menu lateral de um admin: o que já foi feito e o que falta. */
export function StagesSidebar({ loop, status, stages, alive, height, width }: Props) {
  const { lines, focus } = sidebarLines(loop, status, stages);
  const visible = Math.max(3, height - 2);
  const { start, end } = scrollWindow(lines.length, focus, visible);
  const textWidth = width - 4;
  return (
    <Box
      flexDirection="column"
      width={width}
      flexShrink={0}
      borderStyle="single"
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderColor={COLOR.dim}
      paddingRight={1}
    >
      <Text color={COLOR.dim}>{start > 0 ? `↑ ${start} acima` : ' '}</Text>
      {lines.slice(start, end).map((line, index) =>
        line.kind === 'phase' ? (
          <Text key={`p${start + index}`} bold color={COLOR.dim} wrap="truncate-end">
            {`${line.name.toUpperCase()} ${line.delivered}/${line.total}`}
          </Text>
        ) : (
          <Text
            key={`s${line.stage.number}`}
            wrap="truncate-end"
            color={line.situation === 'pending' ? COLOR.dim : undefined}
          >
            {line.situation === 'inProgress' && alive ? (
              <Busy />
            ) : (
              <Text color={STAGE_COLOR[line.situation]}>{STAGE_MARK[line.situation]}</Text>
            )}
            <Text bold={line.situation === 'inProgress'}>
              {` ${String(line.stage.number).padStart(2, '0')} ${line.stage.title}`.slice(0, textWidth)}
            </Text>
          </Text>
        ),
      )}
      <Text color={COLOR.dim}>{end < lines.length ? `↓ ${lines.length - end} abaixo` : ' '}</Text>
    </Box>
  );
}

/** Lateral recolhida dos terminais estreitos: uma linha por fase. */
export function PhaseSummary({ stages }: { stages: LoopStage[] }) {
  return (
    <Text color={COLOR.dim} wrap="truncate-end">
      {phaseSummary(stages)}
    </Text>
  );
}
