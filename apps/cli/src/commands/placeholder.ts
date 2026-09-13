import type { CommandContext, CommandResult, JourneyDetection, JourneyStep, WizardStep } from '../core/command.js';

/**
 * Esqueleto: nenhuma funcionalidade real ainda. Cada comando/etapa só registra o que fará
 * e devolve aviso, para a estrutura (paleta, wizards, menus, jornada e headless) ser navegável.
 */
export const NOT_IMPLEMENTED = 'Ainda não implementado';

export function notImplemented(what: string) {
  return async (ctx: CommandContext): Promise<CommandResult> => {
    ctx.report.info(`${what}: ${NOT_IMPLEMENTED.toLowerCase()}.`);
    if (ctx.dryRun) ctx.report.detail('[dry-run] nada seria executado.');
    return { status: 'warn', summary: NOT_IMPLEMENTED };
  };
}

export const notDetected = async (): Promise<JourneyDetection> => ({ status: 'unknown', detail: 'detecção não implementada' });

export type StepSpec = Omit<WizardStep, 'run'>;

/** Etapa de wizard sem implementação. */
export function placeholderStep(spec: StepSpec): WizardStep {
  return { ...spec, run: notImplemented(spec.label) };
}

export type JourneyStepSpec = Omit<JourneyStep, 'run' | 'detect'>;

/** Passo de jornada sem implementação nem detecção. */
export function placeholderJourneyStep(spec: JourneyStepSpec): JourneyStep {
  return { ...spec, run: notImplemented(spec.label), detect: notDetected };
}
