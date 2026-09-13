import type { Command } from '../core/command.js';

export interface Viewport {
  start: number;
  /** Exclusivo. */
  end: number;
}

/** Linhas que o item ocupa na tela: 1, mais o cabeçalho de grupo quando ele muda. */
function rowsFor(commands: Command[], index: number, start: number): number {
  const command = commands[index];
  const previous = commands[index - 1];
  if (!command) return 0;
  const showsHeader = index === start || command.group !== previous?.group;
  if (!showsHeader) return 1;
  return index === start ? 2 : 3; // cabeçalho (+ linha em branco quando não é o primeiro)
}

function fill(commands: Command[], start: number, budget: number): number {
  let used = 0;
  let index = start;
  while (index < commands.length) {
    const cost = rowsFor(commands, index, start);
    if (used + cost > budget && index > start) break;
    used += cost;
    index += 1;
  }
  return index;
}

/**
 * Janela de itens visíveis: mantém o cursor dentro dela e cabe em `budget` linhas.
 * `start` é a janela anterior, para rolar o mínimo possível.
 */
export function computeViewport(commands: Command[], start: number, cursor: number, budget: number): Viewport {
  if (commands.length === 0) return { start: 0, end: 0 };
  let from = Math.min(Math.max(0, start), commands.length - 1);
  if (cursor < from) from = cursor;
  let end = fill(commands, from, Math.max(1, budget));
  while (cursor >= end && from < cursor) {
    from += 1;
    end = fill(commands, from, Math.max(1, budget));
  }
  return { start: from, end };
}
