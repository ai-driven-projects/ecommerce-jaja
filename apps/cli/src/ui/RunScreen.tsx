import { Box, Static, Text } from 'ink';
import Spinner from 'ink-spinner';
import { useEffect, useRef, useState } from 'react';
import type { Command, CommandResult, LogEntry } from '../core/command.js';
import type { ProjectInfo } from '../core/project.js';
import { runCommand } from '../core/runner.js';
import { ConfirmPrompt, type PendingConfirm } from './ConfirmPrompt.js';
import { LogLine } from './LogLine.js';
import { PickPrompt, type PendingPick } from './PickPrompt.js';
import { StepsPanel, type StepState } from './StepsPanel.js';
import { TextPrompt, type PendingAsk } from './TextPrompt.js';
import { ACCENT } from './theme.js';

interface Props {
  command: Command;
  project: ProjectInfo;
  yes: boolean;
  dryRun: boolean;
  options: Record<string, string>;
  /** Etapas escolhidas quando o comando é um wizard. */
  selection?: string[];
  abort: AbortController;
  onFinish(result: CommandResult): void;
}

interface Item {
  id: number;
  entry: LogEntry;
}

export function RunScreen({ command, project, yes, dryRun, options, selection, abort, onFinish }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [asking, setAsking] = useState<PendingAsk | null>(null);
  const [picking, setPicking] = useState<PendingPick | null>(null);
  const [steps, setSteps] = useState<StepState[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    let active = true;
    const push = (entry: LogEntry) => {
      if (!active) return;
      if (entry.level === 'step' && entry.step) {
        const change = entry.step;
        setSteps((current) => {
          const index = current.findIndex((step) => step.id === change.id);
          if (index === -1) return [...current, { id: change.id, label: change.label, status: change.status }];
          return current.map((step) => (step.id === change.id ? { ...step, status: change.status } : step));
        });
        return;
      }
      counter.current += 1;
      const item = { id: counter.current, entry };
      setItems((current) => [...current, item]);
    };

    runCommand(command, {
      project,
      yes,
      dryRun,
      options,
      selection,
      signal: abort.signal,
      reporter: { log: push },
      prompter: {
        confirm(question, defaultValue) {
          return new Promise<boolean>((resolve) => {
            const onAbort = () => finish(defaultValue);
            const finish = (answer: boolean) => {
              abort.signal.removeEventListener('abort', onAbort);
              setPending(null);
              push({ level: 'detail', message: `${question} → ${answer ? 'sim' : 'não'}` });
              resolve(answer);
            };
            abort.signal.addEventListener('abort', onAbort, { once: true });
            setPending({ question, defaultValue, resolve: finish });
          });
        },
        ask(question, defaultValue, options) {
          return new Promise<string>((resolve) => {
            const onAbort = () => finish(defaultValue);
            const finish = (answer: string) => {
              abort.signal.removeEventListener('abort', onAbort);
              setAsking(null);
              push({ level: 'detail', message: `${question} → ${options?.secret ? (answer ? '••••••' : '(vazio)') : answer || '(vazio)'}` });
              resolve(answer);
            };
            abort.signal.addEventListener('abort', onAbort, { once: true });
            setAsking({ question, defaultValue, secret: options?.secret, resolve: finish });
          });
        },
        pick(question, options, config) {
          return new Promise<string[]>((resolve) => {
            const onAbort = () => finish(config.defaults ?? []);
            const finish = (chosen: string[]) => {
              abort.signal.removeEventListener('abort', onAbort);
              setPicking(null);
              const labels = options.filter((option) => chosen.includes(option.id)).map((option) => option.label);
              push({ level: 'detail', message: `${question} → ${labels.length > 0 ? labels.join(', ') : '(nenhuma)'}` });
              resolve(chosen);
            };
            abort.signal.addEventListener('abort', onAbort, { once: true });
            setPicking({ question, options, config, resolve: finish });
          });
        },
      },
    }).then((outcome) => {
      if (!active) return;
      setResult(outcome);
      onFinish(outcome);
    });
    return () => {
      active = false;
    };
    // O comando só muda quando a tela é recriada (key no App); as demais props são lidas uma vez, na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  return (
    <Box flexDirection="column">
      <Static items={items}>{(item) => <LogLine key={item.id} entry={item.entry} />}</Static>
      {steps.length > 0 ? (
        <Box marginTop={1}>
          <StepsPanel steps={steps} />
        </Box>
      ) : null}
      <Box marginTop={1}>
        {result !== null ? (
          <Text dimColor>Enter ou Esc volta para a lista de comandos.</Text>
        ) : pending ? (
          <ConfirmPrompt pending={pending} />
        ) : asking ? (
          <TextPrompt pending={asking} />
        ) : picking ? (
          <PickPrompt pending={picking} />
        ) : (
          <Text>
            <Text color={ACCENT}>
              <Spinner type="dots" />
            </Text>
            {'  '}
            Executando {command.title}... <Text dimColor>(Esc cancela)</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
}
