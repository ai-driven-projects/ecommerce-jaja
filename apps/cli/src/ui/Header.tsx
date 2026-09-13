import { Box, Text } from 'ink';
import type { ProjectInfo } from '../core/project.js';
import { ACCENT } from './theme.js';

interface Props {
  project: ProjectInfo;
  version: string;
}

export function Header({ project, version }: Props) {
  return (
    <Box borderStyle="round" borderColor={ACCENT} paddingX={1} flexDirection="column">
      <Box>
        <Text bold color={ACCENT}>
          jaja
        </Text>
        <Text dimColor> v{version} · CLI de manutenção do projeto</Text>
      </Box>
      <Text dimColor>{project.rootDir}</Text>
    </Box>
  );
}
