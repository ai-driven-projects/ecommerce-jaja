import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import { ACCENT } from './theme.js';

export interface PendingAsk {
  question: string;
  defaultValue: string;
  secret?: boolean;
  resolve(answer: string): void;
}

export function TextPrompt({ pending }: { pending: PendingAsk }) {
  const [value, setValue] = useState('');
  return (
    <Box>
      <Text color={ACCENT} bold>
        ?{' '}
      </Text>
      <Text>{pending.question} </Text>
      <TextInput
        value={value}
        onChange={setValue}
        mask={pending.secret ? '•' : undefined}
        placeholder={pending.secret ? (pending.defaultValue ? 'Enter mantém o valor atual' : '') : pending.defaultValue}
        onSubmit={(answer) => pending.resolve(answer.trim() || pending.defaultValue)}
      />
    </Box>
  );
}
