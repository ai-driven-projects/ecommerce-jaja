import { Box, Text } from 'ink';
import type { ReactNode } from 'react';
import { ACCENT } from './theme.js';

/**
 * Coluna de largura fixa para linhas de lista. No Ink todo `Text` encolhe (`flexShrink: 1`) quando a
 * linha passa da largura do terminal; sem uma coluna rígida, linhas com detalhe longo perdem colunas à
 * esquerda e o cursor e as bolinhas mudam de posição ao navegar. Só o detalhe final deve encolher.
 */
export function Cell({ width, paddingRight, children }: { width: number; paddingRight?: number; children?: ReactNode }) {
  return (
    <Box width={width} flexShrink={0} paddingRight={paddingRight}>
      {children}
    </Box>
  );
}

/** Cursor da lista: ocupa sempre duas colunas, esteja a linha ativa ou não. */
export function Pointer({ active }: { active: boolean }) {
  return (
    <Cell width={2}>
      <Text color={ACCENT}>{active ? '›' : ' '}</Text>
    </Cell>
  );
}
