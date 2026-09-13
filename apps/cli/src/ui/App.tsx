import { Box, useApp, useInput } from 'ink';
import { useCallback, useState } from 'react';
import type { Command, CommandResult } from '../core/command.js';
import type { ProjectInfo } from '../core/project.js';
import type { CommandRegistry } from '../core/registry.js';
import { Header } from './Header.js';
import { JourneyScreen } from './JourneyScreen.js';
import { Palette } from './Palette.js';
import { RunScreen } from './RunScreen.js';
import { WizardScreen } from './WizardScreen.js';

interface Props {
  project: ProjectInfo;
  registry: CommandRegistry;
  version: string;
  yes: boolean;
  dryRun: boolean;
  /** Opções livres da linha de comando (`--nome=valor`), repassadas a todo comando executado. */
  options: Record<string, string>;
}

type Screen =
  | { kind: 'menu'; parent: Command | null }
  | { kind: 'wizard'; command: Command }
  | { kind: 'journey'; command: Command }
  | { kind: 'run'; command: Command; selection?: string[]; abort: AbortController; result: CommandResult | null; key: number };

export function App({ project, registry, version, yes, dryRun, options }: Props) {
  const { exit } = useApp();
  const [stack, setStack] = useState<Screen[]>([{ kind: 'menu', parent: null }]);
  const screen = stack[stack.length - 1] as Screen;
  const push = (next: Screen) => setStack((current) => [...current, next]);
  const pop = () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  const search = useCallback((query: string) => registry.filter(query), [registry]);

  useInput((_input, key) => {
    if (screen.kind === 'run') {
      if (screen.result === null) {
        if (key.escape) screen.abort.abort();
        return;
      }
      if (key.escape || key.return) pop();
      return;
    }
    if (key.escape) {
      if (stack.length === 1) exit();
      else pop();
    }
  });

  const open = (command: Command) => {
    if (command.kind === 'menu') push({ kind: 'menu', parent: command });
    else if (command.kind === 'wizard') push({ kind: 'wizard', command });
    else if (command.kind === 'journey') push({ kind: 'journey', command });
    else push({ kind: 'run', command, abort: new AbortController(), result: null, key: Date.now() });
  };

  const runWizard = (command: Command, selection: string[]) =>
    setStack((current) => [
      ...current.slice(0, -1), // substitui a checklist pela execução; Esc volta ao menu
      { kind: 'run', command, selection, abort: new AbortController(), result: null, key: Date.now() },
    ]);

  // Na jornada a execução empilha por cima: ao voltar, a lista remonta sem seleção e detecta o estado de novo.
  const runJourney = (command: Command, selection: string[]) =>
    push({ kind: 'run', command, selection, abort: new AbortController(), result: null, key: Date.now() });

  return (
    <Box flexDirection="column">
      <Header project={project} version={version} />
      {screen.kind === 'menu' ? (
        <Palette
          key={screen.parent?.id ?? 'root'} // remonta ao mudar de nível: cursor e filtro começam do zero
          items={screen.parent ? (screen.parent.children ?? []) : registry.roots()}
          search={search}
          heading={screen.parent?.title}
          onSelect={open}
        />
      ) : screen.kind === 'wizard' ? (
        <WizardScreen command={screen.command} onRun={(selection) => runWizard(screen.command, selection)} />
      ) : screen.kind === 'journey' ? (
        <JourneyScreen command={screen.command} project={project} dryRun={dryRun} onRun={(selection) => runJourney(screen.command, selection)} />
      ) : (
        <RunScreen
          key={screen.key}
          command={screen.command}
          project={project}
          yes={yes}
          dryRun={dryRun}
          options={options}
          selection={screen.selection}
          abort={screen.abort}
          onFinish={(result) =>
            setStack((current) => current.map((item, index) => (index === current.length - 1 && item.kind === 'run' ? { ...item, result } : item)))
          }
        />
      )}
    </Box>
  );
}
