import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { oneLine } from '../../loops/format.js';
import type { PendingSpec } from '../../loops/openspec.js';
import { scrollWindow } from '../../loops/presentation.js';
import { COLOR } from './common.js';
import { filterSpecs, toggleInOrder } from './spec-selection.js';
import { applyTyping } from './typing.js';

export type SpecForLoop = PendingSpec & { inLoop?: string };

interface Props {
  specs: SpecForLoop[];
  initialOrder: string[];
  onConfirm: (order: string[]) => void;
  onBack: (order: string[]) => void;
}

const VISIBLE_ROWS = 12;

/**
 * Escolha das specs pendentes que viram as etapas do loop, na ordem em que são
 * marcadas: digitar filtra, espaço marca ou desmarca (renumerando), enter confirma.
 */
export function SpecPicker({ specs, initialOrder, onConfirm, onBack }: Props) {
  const [filter, setFilter] = useState('');
  const [cursor, setCursor] = useState(0);
  const [order, setOrder] = useState(initialOrder);
  const [error, setError] = useState<string>();
  const visible = filterSpecs(specs, filter);
  const position = Math.min(cursor, visible.length - 1);
  const current = visible[position];

  useInput((input, key) => {
    setError(undefined);
    if (key.escape) {
      if (filter) {
        setFilter('');
        return setCursor(0);
      }
      return onBack(order);
    }
    if (key.return) {
      if (!order.length) return setError('marque pelo menos uma spec com espaço');
      return onConfirm(order);
    }
    if (key.upArrow) return setCursor(Math.max(0, position - 1));
    if (key.downArrow) return setCursor(Math.min(visible.length - 1, position + 1));
    if (input === ' ') {
      if (!current) return;
      if (current.inLoop) return setError(`${current.name} já é uma etapa do loop ${current.inLoop}`);
      return setOrder((o) => toggleInOrder(o, current.name));
    }
    const next = applyTyping(filter, input, key);
    if (next !== filter) {
      setFilter(next);
      setCursor(0);
    }
  });

  const { start, end } = scrollWindow(visible.length, Math.max(0, position), VISIBLE_ROWS);
  const nameWidth = Math.max(0, ...visible.map((spec) => spec.name.length)) + 2;
  return (
    <Box flexDirection="column">
      <Text>
        Specs pendentes <Text color={COLOR.dim}>({specs.length})</Text> · filtro:{' '}
        {filter ? <Text color={COLOR.accent}>{filter}</Text> : <Text color={COLOR.dim}>digite para filtrar</Text>}
      </Text>
      <Box marginTop={1} flexDirection="column">
        {!visible.length && <Text color={COLOR.dim}>nenhuma spec com &quot;{filter}&quot;</Text>}
        {start > 0 && <Text color={COLOR.dim}> ↑ mais {start}</Text>}
        {visible.slice(start, end).map((spec) => {
          const active = spec === current;
          const place = order.indexOf(spec.name);
          const mark = place >= 0 ? String(place + 1).padStart(2) : spec.inLoop ? ' ·' : '  ';
          const tasks = spec.tasks ? `${spec.tasks.done}/${spec.tasks.total} tarefas` : 'sem tasks.md';
          return (
            <Text key={spec.name} wrap="truncate-end" color={spec.inLoop ? COLOR.dim : undefined}>
              <Text color={COLOR.accent}>{active ? '› ' : '  '}</Text>
              <Text color={place >= 0 ? COLOR.success : COLOR.dim}>[{mark}]</Text>{' '}
              <Text bold={active}>{spec.name.padEnd(nameWidth)}</Text>
              <Text color={COLOR.dim}>
                {spec.inLoop ? `no loop ${spec.inLoop}` : tasks}
                {spec.summary ? ` · ${oneLine(spec.summary, 90)}` : ''}
              </Text>
            </Text>
          );
        })}
        {end < visible.length && <Text color={COLOR.dim}> ↓ mais {visible.length - end}</Text>}
      </Box>
      <Box marginTop={1}>
        <Text wrap="truncate-end">
          <Text color={COLOR.dim}>Ordem: </Text>
          {order.length ? (
            order.map((name, index) => `${index + 1}. ${name}`).join('  →  ')
          ) : (
            <Text color={COLOR.dim}>nenhuma marcada</Text>
          )}
        </Text>
      </Box>
      {error && <Text color={COLOR.error}>{error}</Text>}
      <Box marginTop={1}>
        <Text color={COLOR.dim}>
          ↑↓ navega · espaço marca na ordem (desmarcar renumera) · enter prepara o loop · esc{' '}
          {filter ? 'limpa o filtro' : 'volta'}
        </Text>
      </Box>
    </Box>
  );
}
