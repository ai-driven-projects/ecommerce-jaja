import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { Command, WizardStep } from '../core/command.js';
import { defaultSelection, resolveSelection } from '../core/wizard.js';
import { Cell, Pointer } from './columns.js';
import { ACCENT } from './theme.js';

interface Props {
  command: Command;
  onRun(selection: string[]): void;
}

/** Checklist das etapas de um wizard. Espaço marca, Enter executa, A marca/desmarca tudo. */
export function WizardScreen({ command, onRun }: Props) {
  const steps: WizardStep[] = command.steps ?? [];
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelection(steps)));
  const [cursor, setCursor] = useState(0);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useInput((input, key) => {
    if (key.upArrow) setCursor((current) => Math.max(0, current - 1));
    if (key.downArrow) setCursor((current) => Math.min(steps.length - 1, current + 1));
    if (input === ' ') {
      const step = steps[cursor];
      if (step) toggle(step.id);
    }
    if (input.toLowerCase() === 'a') {
      setSelected((current) => (current.size === steps.length ? new Set() : new Set(steps.map((step) => step.id))));
    }
    if (key.return) onRun([...selected]);
  });

  const { steps: effective, added } = resolveSelection(steps, selected);
  const addedSet = new Set(added);

  return (
    <Box flexDirection="column" marginTop={1} paddingX={1}>
      <Text>
        <Text bold color={ACCENT}>
          {command.title}
        </Text>
        <Text dimColor> · marque o que deseja executar</Text>
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {steps.map((step, index) => {
          const active = index === cursor;
          const checked = selected.has(step.id);
          const implied = !checked && addedSet.has(step.id);
          return (
            <Box key={step.id} flexDirection="column">
              <Box>
                <Pointer active={active} />
                <Cell width={2}>
                  <Text color={checked ? 'green' : implied ? 'yellow' : 'gray'}>{checked ? '●' : implied ? '◎' : '○'}</Text>
                </Cell>
                <Cell width={30}>
                  <Text bold={active} color={active ? ACCENT : undefined} wrap="truncate">
                    {step.label}
                  </Text>
                </Cell>
                <Text dimColor wrap="truncate">
                  {step.description ?? ''}
                </Text>
              </Box>
              {active && step.danger ? (
                <Box paddingLeft={4}>
                  <Text color="yellow">▲ {step.danger}</Text>
                </Box>
              ) : null}
              {active && implied ? (
                <Box paddingLeft={4}>
                  <Text color="yellow">incluída automaticamente: outra etapa marcada depende dela</Text>
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {effective.length} etapa(s) a executar · Espaço marca · A tudo/nada · Enter executa · Esc volta
        </Text>
      </Box>
    </Box>
  );
}
