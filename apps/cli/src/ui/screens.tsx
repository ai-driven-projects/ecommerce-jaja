import type { ReactNode } from 'react';
import type { ProjectInfo } from '../core/project.js';
import { LoopsScreen } from './loops/LoopsScreen.js';

export interface ScreenProps {
  project: ProjectInfo;
  /** Volta para o menu de onde a tela foi aberta. */
  onExit(): void;
}

/**
 * Telas próprias dos comandos `kind: 'screen'`, por id. A tela cuida das próprias teclas,
 * inclusive do Esc, e chama `onExit` para voltar.
 */
export const SCREENS: Record<string, (props: ScreenProps) => ReactNode> = {
  loops: ({ project, onExit }) => <LoopsScreen rootDir={project.rootDir} onExit={onExit} />,
  'loops:new': ({ project, onExit }) => <LoopsScreen rootDir={project.rootDir} initial="new" onExit={onExit} />,
};
