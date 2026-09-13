import type { WizardStep } from '../../core/command.js';
import { wizard } from '../../core/wizard.js';
import { placeholderStep } from '../placeholder.js';

export const qualitySteps: WizardStep[] = [
  placeholderStep({ id: 'lint', label: 'Lint', description: 'npm run lint (turbo)', defaultSelected: true, continueOnError: true }),
  placeholderStep({ id: 'check-types', label: 'Tipos', description: 'npm run check-types (turbo)', defaultSelected: true, continueOnError: true }),
  placeholderStep({ id: 'test', label: 'Testes', description: 'npm run test (turbo)', defaultSelected: true, continueOnError: true }),
  placeholderStep({ id: 'build', label: 'Build', description: 'npm run build (turbo)', defaultSelected: false }),
];

export const qualityWizard = wizard({
  id: 'quality',
  title: 'Qualidade',
  description: 'Lint, tipos, testes e build em todos os pacotes',
  group: 'Projeto',
  icon: '🧪',
  keywords: ['lint', 'eslint', 'tsc', 'tipos', 'test', 'teste', 'build', 'ci'],
  steps: qualitySteps,
});
