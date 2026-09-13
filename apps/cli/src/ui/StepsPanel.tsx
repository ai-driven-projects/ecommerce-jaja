import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import type { StepStatus } from '../core/command.js';
import { STEP_ICON } from '../core/reporter.js';
import { Cell } from './columns.js';
import { ACCENT } from './theme.js';

export interface StepState {
  id: string;
  label: string;
  status: StepStatus;
}

const COLOR: Record<StepStatus, string | undefined> = {
  pending: undefined,
  running: ACCENT,
  ok: 'green',
  warn: 'yellow',
  error: 'red',
  skipped: undefined,
};

/** Checklist de progresso das etapas de um wizard, atualizada em tempo real. */
export function StepsPanel({ steps }: { steps: StepState[] }) {
  const done = steps.filter((step) => step.status === 'ok' || step.status === 'warn' || step.status === 'error' || step.status === 'skipped').length;
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
      <Text dimColor>
        Progresso {done}/{steps.length}
      </Text>
      {steps.map((step) => (
        <Box key={step.id}>
          <Cell width={2}>
            <Text color={COLOR[step.status]}>{step.status === 'running' ? <Spinner type="dots" /> : STEP_ICON[step.status]}</Text>
          </Cell>
          <Text bold={step.status === 'running'} dimColor={step.status === 'pending' || step.status === 'skipped'} color={COLOR[step.status]}>
            {step.label}
          </Text>
          {step.status === 'skipped' ? <Text dimColor> (pulada)</Text> : null}
        </Box>
      ))}
    </Box>
  );
}
