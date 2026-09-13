import { Box, Text, useInput } from 'ink';
import { ACCENT } from './theme.js';

export interface PendingConfirm {
  question: string;
  defaultValue: boolean;
  resolve(answer: boolean): void;
}

export function ConfirmPrompt({ pending }: { pending: PendingConfirm }) {
  useInput((input, key) => {
    const char = input.toLowerCase();
    if (char === 's' || char === 'y') pending.resolve(true);
    else if (char === 'n') pending.resolve(false);
    else if (key.return) pending.resolve(pending.defaultValue);
  });

  return (
    <Box>
      <Text color={ACCENT} bold>
        ?{' '}
      </Text>
      <Text>{pending.question} </Text>
      <Text dimColor>{pending.defaultValue ? '(S/n)' : '(s/N)'}</Text>
    </Box>
  );
}
