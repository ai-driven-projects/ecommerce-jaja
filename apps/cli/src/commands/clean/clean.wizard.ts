import type { WizardStep } from '../../core/command.js';
import { wizard } from '../../core/wizard.js';
import { placeholderStep } from '../placeholder.js';

export const cleanSteps: WizardStep[] = [
  placeholderStep({ id: 'build', label: 'Saídas de build', description: 'dist, .next, coverage, relatórios e tsbuildinfo', defaultSelected: true }),
  placeholderStep({ id: 'cache', label: 'Caches', description: '.turbo, .cache, .eslintcache e afins', defaultSelected: true }),
  placeholderStep({
    id: 'deps',
    label: 'node_modules',
    description: 'Todos os node_modules do monorepo',
    defaultSelected: false,
    danger: 'Depois disso rode o setup (npm install) antes de usar o CLI de novo.',
  }),
  placeholderStep({ id: 'lock', label: 'package-lock.json', description: 'Força uma resolução nova de dependências', defaultSelected: false, danger: 'Pode mudar versões instaladas na próxima instalação.' }),
  placeholderStep({
    id: 'db',
    label: 'Volume do banco local',
    description: 'docker compose down -v (apaga todos os dados locais)',
    defaultSelected: false,
    danger: 'Apaga TODOS os dados do PostgreSQL local.',
  }),
];

export const cleanWizard = wizard({
  id: 'clean',
  title: 'Limpeza',
  description: 'Remove builds, caches, node_modules, lockfile e o volume do banco local',
  group: 'Projeto',
  icon: '🧹',
  keywords: ['limpar', 'apagar', 'remover', 'node_modules', 'dist', 'cache', 'reset'],
  steps: cleanSteps,
});
