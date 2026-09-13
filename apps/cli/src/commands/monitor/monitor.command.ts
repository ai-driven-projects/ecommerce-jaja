import type { Command } from '../../core/command.js';
import { notImplemented } from '../placeholder.js';

export const monitorCommand: Command = {
  id: 'monitor',
  title: 'Produção',
  description: 'Verifica o ambiente publicado: backend, banco, frontend e CI/CD (somente leitura)',
  group: 'Produção',
  icon: '📡',
  keywords: ['monitor', 'status', 'saude', 'health', 'producao', 'uptime'],
  run: notImplemented('Monitoramento de produção'),
};
