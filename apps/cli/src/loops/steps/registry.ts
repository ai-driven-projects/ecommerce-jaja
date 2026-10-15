import type { StepId } from '../types.js';
import { apply, archive } from './apply.js';
import { briefing } from './briefing.js';
import { commitDelivery, commitProposal } from './commits.js';
import type { Step } from './context.js';
import { propose } from './propose.js';
import { baseline, verifyChange } from './verify.js';

/**
 * Os passos que um loop pode usar, por id. O `briefing` não está no padrão (o
 * propose estuda a etapa sozinho), mas fica aqui para quem quiser listá-lo. Um
 * passo novo é um arquivo nesta pasta e uma entrada aqui; o loop.json só ganha o
 * id na lista `config.steps`.
 */
export const STEPS: Record<StepId, Step> = {
  briefing,
  propose,
  baseline,
  commitProposal,
  apply,
  verifyChange,
  archive,
  commitDelivery,
};

/** Os passos da configuração, na ordem. Id desconhecido é erro (o loop não começa). */
export function resolveSteps(ids: string[]): { steps: Step[]; errors: string[] } {
  const errors = ids.filter((id) => !(id in STEPS)).map((id) => `passo desconhecido "${id}" em config.steps`);
  for (const id of ids) {
    const step = STEPS[id as StepId] as Step | undefined;
    if (step && typeof step.postcondition !== 'function') errors.push(`o passo "${id}" não declara pós-condição`);
  }
  if (!ids.length) errors.push('config.steps está vazio');
  if (ids.length && ids.at(-1) !== 'commitDelivery')
    errors.push('o último passo precisa ser "commitDelivery" (é ele que entrega a etapa)');
  return { steps: errors.length ? [] : ids.map((id) => STEPS[id as StepId]), errors };
}
