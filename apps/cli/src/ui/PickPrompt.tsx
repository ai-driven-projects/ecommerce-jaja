import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import type { PickConfig, PickOption } from '../core/command.js';
import { Cell, Pointer } from './columns.js';
import { ACCENT } from './theme.js';

export interface PendingPick {
  question: string;
  options: PickOption[];
  config: PickConfig;
  resolve(chosen: string[]): void;
}

/** Lista de escolha dentro da execução: Espaço marca (multi), Enter confirma, A tudo/nada. */
export function PickPrompt({ pending }: { pending: PendingPick }) {
  const { options, config } = pending;
  const multi = config.multi === true;
  const required = config.required ?? multi;
  const [selected, setSelected] = useState<Set<string>>(() => new Set(config.defaults ?? []));
  const [cursor, setCursor] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useInput((input, key) => {
    setNotice(null);
    if (key.upArrow) setCursor((current) => Math.max(0, current - 1));
    if (key.downArrow) setCursor((current) => Math.min(options.length - 1, current + 1));
    if (key.pageUp) setCursor((current) => Math.max(0, current - 10));
    if (key.pageDown) setCursor((current) => Math.min(options.length - 1, current + 10));
    const option = options[cursor];
    if (input === ' ' && option) {
      setSelected((current) => {
        const next = multi ? new Set(current) : new Set<string>();
        if (current.has(option.id)) next.delete(option.id);
        else next.add(option.id);
        return next;
      });
    }
    if (multi && input.toLowerCase() === 'a') {
      setSelected((current) => (current.size === options.length ? new Set() : new Set(options.map((item) => item.id))));
    }
    if (!key.return) return;
    // Enter numa escolha única escolhe o item sob o cursor quando nada está marcado.
    const chosen = multi || selected.size > 0 ? options.filter((item) => selected.has(item.id)).map((item) => item.id) : option ? [option.id] : [];
    if (required && chosen.length === 0) {
      setNotice('Escolha ao menos uma opção (Espaço marca).');
      return;
    }
    pending.resolve(chosen);
  });

  // Janela de itens visíveis, para listas longas.
  const budget = 14;
  const start = Math.max(0, Math.min(cursor - Math.floor(budget / 2), options.length - budget));
  const visible = options.slice(start, start + budget);

  return (
    <Box flexDirection="column">
      <Text>
        <Text color={ACCENT} bold>
          ?{' '}
        </Text>
        {pending.question}
        <Text dimColor> · {selected.size} marcada(s)</Text>
      </Text>
      {start > 0 ? <Text dimColor>  ↑ {start} acima</Text> : null}
      {visible.map((option, offset) => {
        const index = start + offset;
        const active = index === cursor;
        const checked = selected.has(option.id);
        return (
          <Box key={option.id}>
            <Pointer active={active} />
            <Cell width={2}>
              <Text color={checked ? 'green' : 'gray'}>{checked ? '●' : '○'}</Text>
            </Cell>
            <Cell width={34} paddingRight={1}>
              <Text bold={active} color={active ? ACCENT : undefined} wrap="truncate">
                {option.label}
              </Text>
            </Cell>
            <Text dimColor wrap="truncate">
              {option.description ?? ''}
            </Text>
          </Box>
        );
      })}
      {start + budget < options.length ? <Text dimColor>  ↓ {options.length - start - budget} abaixo</Text> : null}
      {notice ? <Text color="yellow">{notice}</Text> : null}
      <Text dimColor>{multi ? 'Espaço marca · A tudo/nada · Enter confirma' : 'Espaço/Enter escolhe'}</Text>
    </Box>
  );
}
