import { Box, Text } from 'ink';
import type { LogEntry } from '../core/command.js';
import { Cell } from './columns.js';
import { LEVEL_STYLE } from './theme.js';

export function LogLine({ entry }: { entry: LogEntry }) {
  const style = LEVEL_STYLE[entry.level];
  if (entry.level === 'step') return null;
  if (entry.level === 'title') {
    return (
      <Box marginTop={1}>
        <Text bold color={style.color}>
          {entry.message}
        </Text>
      </Box>
    );
  }
  if (entry.level === 'detail') {
    return (
      <Box paddingLeft={4}>
        <Text dimColor>{entry.message}</Text>
      </Box>
    );
  }
  return (
    <Box>
      <Cell width={2}>
        <Text color={style.color}>{style.icon}</Text>
      </Cell>
      <Text>{entry.message}</Text>
    </Box>
  );
}
