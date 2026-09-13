import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import { useMemo, useState } from 'react';
import type { Command } from '../core/command.js';
import type { CommandEntry } from '../core/registry.js';
import { Cell, Pointer } from './columns.js';
import { ACCENT } from './theme.js';
import { computeViewport } from './viewport.js';

interface Props {
  /** Itens mostrados sem filtro (nível atual do menu). */
  items: Command[];
  /** Busca em toda a árvore quando há texto digitado. */
  search(query: string): CommandEntry[];
  /** Título do menu atual (vazio no menu inicial). */
  heading?: string;
  onSelect(command: Command): void;
}

/** Cabeçalho de seção: o grupo do item ou, em resultados de busca, o caminho do menu de origem. */
function groupKey(entry: CommandEntry): string {
  return entry.breadcrumb.length > 0 ? entry.breadcrumb.map((item) => item.title).join(' › ') : entry.command.group;
}

/** Linhas fixas fora da lista: cabeçalho (4), caixa de busca (3), indicadores (2), dica (1) e margens. */
const FIXED_ROWS = 13;

export function Palette({ items, search, heading, onSelect }: Props) {
  const { stdout } = useStdout();
  const [query, setQuery] = useState('');
  /** Cursor e início da janela andam juntos: a janela lembra onde estava para rolar o mínimo. */
  const [nav, setNav] = useState({ cursor: 0, start: 0 });
  const filtered = useMemo<CommandEntry[]>(() => {
    if (!query.trim()) return items.map((command) => ({ command, breadcrumb: [] }));
    // Resultados agrupados pelo menu de origem, na ordem em que cada grupo aparece por relevância.
    const results = search(query);
    const order = new Map<string, number>();
    for (const entry of results) if (!order.has(groupKey(entry))) order.set(groupKey(entry), order.size);
    return [...results].sort((a, b) => (order.get(groupKey(a)) ?? 0) - (order.get(groupKey(b)) ?? 0));
  }, [items, search, query]);

  const budget = Math.max(3, (stdout?.rows || 30) - FIXED_ROWS);
  const commands = filtered.map((entry) => entry.command);
  const { cursor } = nav;

  const changeQuery = (value: string) => {
    setQuery(value);
    setNav({ cursor: 0, start: 0 });
  };

  const move = (delta: number) =>
    setNav((current) => {
      const next = Math.min(Math.max(0, current.cursor + delta), Math.max(0, filtered.length - 1));
      return { cursor: next, start: computeViewport(commands, current.start, next, budget).start };
    });

  useInput((_input, key) => {
    if (key.upArrow) move(-1);
    if (key.downArrow) move(1);
    if (key.pageUp) move(-5);
    if (key.pageDown) move(5);
  });

  const submit = () => {
    const selected = filtered[cursor];
    if (selected) onSelect(selected.command);
  };

  const view = computeViewport(commands, nav.start, cursor, budget);
  const visible = filtered.slice(view.start, view.end);
  const above = view.start;
  const below = filtered.length - view.end;

  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="round" borderColor={ACCENT} paddingX={1}>
        <Text color={ACCENT} bold>
          {heading ? `${heading} ❯ ` : '❯ '}
        </Text>
        <TextInput value={query} onChange={changeQuery} onSubmit={submit} placeholder={heading ? 'Filtrar ações...' : 'O que você quer fazer? Digite para buscar...'} />
      </Box>

      <Box flexDirection="column" paddingX={1}>
        {filtered.length === 0 ? (
          <Text dimColor>Nenhum comando corresponde a "{query}".</Text>
        ) : (
          <>
            <Text dimColor>{above > 0 ? `↑ ${above} acima` : ' '}</Text>
            {visible.map(({ command, breadcrumb }, offset) => {
              const index = view.start + offset;
              const active = index === cursor;
              const entry = { command, breadcrumb };
              const previous = filtered[index - 1];
              const showsHeader = !heading && (offset === 0 || !previous || groupKey(entry) !== groupKey(previous));
              // Ícone sempre no início: o do próprio item ou, em resultados de busca, o da raiz.
              const icon = command.icon ?? breadcrumb[0]?.icon;
              const title = `${icon ? `${icon} ` : ''}${command.title}`;
              return (
                <Box key={command.id} flexDirection="column">
                  {showsHeader ? (
                    <Box marginTop={offset === 0 ? 0 : 1}>
                      <Text dimColor bold>
                        {groupKey(entry).toUpperCase()}
                      </Text>
                    </Box>
                  ) : null}
                  <Box>
                    <Pointer active={active} />
                    <Cell width={37} paddingRight={1}>
                      <Text bold={active} color={active ? ACCENT : undefined} wrap="truncate">
                        {title}
                      </Text>
                    </Cell>
                    <Text dimColor wrap="truncate">
                      {command.description}
                    </Text>
                  </Box>
                </Box>
              );
            })}
            <Text dimColor>{below > 0 ? `↓ ${below} abaixo` : ' '}</Text>
          </>
        )}
      </Box>

      <Box paddingX={1}>
        <Text dimColor>
          {cursor + 1}/{filtered.length} · ↑↓ navegar · Enter abrir · Esc {heading ? 'voltar' : 'sair'}
        </Text>
      </Box>
    </Box>
  );
}
