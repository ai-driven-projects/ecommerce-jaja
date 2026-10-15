import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { Action } from '../../loops/presentation.js';
import { ACCENT } from '../theme.js';
import type { Message } from './useLoopActions.js';

export const COLOR = { accent: ACCENT, success: 'green', warn: 'yellow', error: 'red', dim: 'gray' } as const;

const MESSAGE_COLOR: Record<Message['kind'], string> = { ok: COLOR.success, warn: COLOR.warn, error: COLOR.error };

export function Messages({ messages, max = 4 }: { messages: Message[]; max?: number }) {
  if (!messages.length) return null;
  return (
    <Box flexDirection="column" flexShrink={0}>
      {messages.slice(0, max).map((message, index) => (
        <Text key={index} color={MESSAGE_COLOR[message.kind]} wrap="truncate-end">
          {message.text}
        </Text>
      ))}
    </Box>
  );
}

/** "i iniciar · d detalhes · esc volta" */
export function Keys({ actions, extras = [] }: { actions: Action[]; extras?: Action[] }) {
  const all = [...actions, ...extras];
  return (
    <Text wrap="truncate-end">
      {all.map((action, index) => (
        <Text key={action.key + action.label}>
          {index > 0 && <Text color={COLOR.dim}> · </Text>}
          <Text bold color={COLOR.accent}>
            {action.key}
          </Text>
          <Text color={COLOR.dim}> {action.label}</Text>
        </Text>
      ))}
    </Text>
  );
}

/** Barra de progresso em blocos: cheia na cor dada, o resto apagado. */
export function Bar({
  done,
  total,
  width,
  color = COLOR.accent,
}: {
  done: number;
  total: number;
  width: number;
  color?: string;
}) {
  const fraction = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const full = Math.round(fraction * width);
  return (
    <Text>
      <Text color={color}>{'█'.repeat(full)}</Text>
      <Text color={COLOR.dim}>{'░'.repeat(Math.max(0, width - full))}</Text>
    </Text>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <Text bold color={COLOR.dim}>
      {children.toUpperCase()}
    </Text>
  );
}

export function Busy() {
  return (
    <Text color={COLOR.accent}>
      <Spinner type="dots" />
    </Text>
  );
}

/** Pergunta sim/não: `s`/`y` confirma; `n`, Esc ou Enter cancelam (o padrão é não). */
export function YesNo({ question, onYes, onNo }: { question: string; onYes: () => void; onNo: () => void }) {
  useInput((input, key) => {
    const char = input.toLowerCase();
    if (char === 's' || char === 'y') onYes();
    else if (char === 'n' || key.escape || key.return) onNo();
  });
  return (
    <Box flexShrink={0}>
      <Text color={COLOR.accent} bold>
        ?{' '}
      </Text>
      <Text wrap="wrap">
        {question} <Text dimColor>(s/N)</Text>
      </Text>
    </Box>
  );
}
