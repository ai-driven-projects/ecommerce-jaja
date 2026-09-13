import type { Command } from './command.js';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Pontuação de relevância de um comando para a busca; 0 = não corresponde. */
export function scoreCommand(command: Command, query: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const id = normalize(command.id);
  const title = normalize(command.title);
  const keywords = (command.keywords ?? []).map(normalize);
  const description = normalize(command.description);
  const group = normalize(command.group);

  if (id === q) return 100;
  if (id.startsWith(q)) return 90;
  if (title.startsWith(q)) return 80;
  if (id.includes(q) || title.includes(q)) return 70;
  if (keywords.some((keyword) => keyword.startsWith(q))) return 60;
  if (keywords.some((keyword) => keyword.includes(q))) return 50;
  if (group.includes(q)) return 40;
  if (description.includes(q)) return 30;

  // Todas as palavras da busca aparecem em algum campo (ordem livre).
  const haystack = [id, title, group, description, ...keywords].join(' ');
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => haystack.includes(word))) return 20;
  return 0;
}

export function filterCommands(commands: Command[], query: string): Command[] {
  return commands
    .map((command, index) => ({ command, index, score: scoreCommand(command, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.command);
}

/** Comando com o caminho de menus até ele (vazio para os de primeiro nível). */
export interface CommandEntry {
  command: Command;
  breadcrumb: Command[];
}

/** Percorre a árvore de menus em profundidade. */
export function flattenCommands(commands: Command[], breadcrumb: Command[] = []): CommandEntry[] {
  return commands.flatMap((command) => [
    { command, breadcrumb },
    ...(command.children ? flattenCommands(command.children, [...breadcrumb, command]) : []),
  ]);
}

export interface CommandRegistry {
  /** Comandos de primeiro nível, na ordem do menu. */
  roots(): Command[];
  /** Todos os comandos, inclusive os aninhados em menus. */
  all(): CommandEntry[];
  find(id: string): Command | undefined;
  /** Busca em toda a árvore. */
  filter(query: string): CommandEntry[];
}

export function createRegistry(roots: Command[]): CommandRegistry {
  const entries = flattenCommands(roots);
  const byId = new Map<string, Command>();
  for (const { command } of entries) {
    if (byId.has(command.id)) throw new Error(`Comando duplicado: ${command.id}`);
    byId.set(command.id, command);
  }
  return {
    roots: () => roots,
    all: () => entries,
    find: (id) => byId.get(id),
    filter: (query) => {
      const matched = new Set(filterCommands(entries.map((entry) => entry.command), query));
      return [...matched].map((command) => entries.find((entry) => entry.command === command) as CommandEntry);
    },
  };
}
