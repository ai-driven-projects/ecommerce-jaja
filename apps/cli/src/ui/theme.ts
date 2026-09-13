import type { LogLevel } from '../core/command.js';
import { LEVEL_ICON } from '../core/reporter.js';

export interface LevelStyle {
  icon: string;
  color?: string;
  dim?: boolean;
  bold?: boolean;
}

export const LEVEL_STYLE: Record<LogLevel, LevelStyle> = {
  title: { icon: LEVEL_ICON.title, color: 'cyan', bold: true },
  info: { icon: LEVEL_ICON.info, color: 'blue' },
  detail: { icon: LEVEL_ICON.detail, dim: true },
  success: { icon: LEVEL_ICON.success, color: 'green' },
  warn: { icon: LEVEL_ICON.warn, color: 'yellow' },
  error: { icon: LEVEL_ICON.error, color: 'red' },
  step: { icon: LEVEL_ICON.step, color: 'cyan' },
};

export const ACCENT = 'cyan';
