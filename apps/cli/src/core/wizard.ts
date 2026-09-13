import type { Command, CommandContext, CommandResult, WizardStep } from './command.js';

/**
 * Etapas efetivamente executadas a partir da seleção: inclui dependências (`requires`)
 * e preserva a ordem de declaração do wizard.
 */
export function resolveSelection(steps: WizardStep[], selectedIds: Iterable<string>): { steps: WizardStep[]; added: string[] } {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const wanted = new Set<string>();
  const added: string[] = [];
  const visit = (id: string, explicit: boolean) => {
    const step = byId.get(id);
    if (!step || wanted.has(id)) return;
    for (const dependency of step.requires ?? []) {
      if (!wanted.has(dependency) && byId.has(dependency)) {
        const wasExplicit = [...selectedIds].includes(dependency);
        if (!wasExplicit) added.push(dependency);
        visit(dependency, wasExplicit);
      }
    }
    wanted.add(id);
    if (!explicit && !added.includes(id)) added.push(id);
  };
  for (const id of selectedIds) visit(id, true);
  return { steps: steps.filter((step) => wanted.has(step.id)), added: [...new Set(added)] };
}

export function defaultSelection(steps: WizardStep[]): string[] {
  return steps.filter((step) => step.defaultSelected).map((step) => step.id);
}

/** Executa as etapas em ordem, emitindo eventos de progresso. Para na primeira falha, salvo `continueOnError`. */
export async function runSteps(ctx: CommandContext, steps: WizardStep[]): Promise<CommandResult> {
  if (steps.length === 0) return { status: 'warn', summary: 'Nenhuma etapa selecionada' };
  for (const step of steps) ctx.report.step(step.id, step.label, 'pending');

  const failed: string[] = [];
  const warned: string[] = [];
  let halted = false;
  for (const step of steps) {
    if (halted || ctx.signal.aborted) {
      ctx.report.step(step.id, step.label, 'skipped');
      continue;
    }
    ctx.report.step(step.id, step.label, 'running');
    ctx.report.title(step.label);
    let result: CommandResult;
    try {
      result = await step.run(ctx);
    } catch (error) {
      result = { status: 'error', summary: error instanceof Error ? error.message : String(error) };
    }
    if (ctx.signal.aborted) {
      ctx.report.step(step.id, step.label, 'skipped');
      halted = true;
      continue;
    }
    ctx.report.step(step.id, step.label, result.status);
    if (result.status === 'ok') ctx.report.success(result.summary);
    else if (result.status === 'warn') {
      ctx.report.warn(result.summary);
      warned.push(step.label);
    } else {
      ctx.report.error(result.summary);
      failed.push(step.label);
      if (!step.continueOnError) halted = true;
    }
  }

  if (ctx.signal.aborted) return { status: 'warn', summary: 'Interrompido' };
  if (failed.length > 0) return { status: 'error', summary: `Falhou em: ${failed.join(', ')}` };
  if (warned.length > 0) return { status: 'warn', summary: `Concluído com avisos em: ${warned.join(', ')}` };
  return { status: 'ok', summary: `${steps.length} etapa(s) concluída(s)` };
}

export interface WizardSpec {
  id: string;
  title: string;
  description: string;
  group: string;
  icon?: string;
  keywords?: string[];
  steps: WizardStep[];
}

/**
 * Cria um comando do tipo wizard. Em modo headless a seleção vem de `--steps`/`--all`
 * (lidos pelo runner em `ctx`), ou dos padrões.
 */
export function wizard(spec: WizardSpec): Command {
  return {
    ...spec,
    kind: 'wizard',
    async run(ctx) {
      const selected = ctx.selection ?? defaultSelection(spec.steps);
      const { steps, added } = resolveSelection(spec.steps, selected);
      if (added.length > 0) ctx.report.info(`Incluídas por dependência: ${added.join(', ')}`);
      const unknown = [...selected].filter((id) => !spec.steps.some((step) => step.id === id));
      if (unknown.length > 0) {
        return { status: 'error', summary: `Etapas desconhecidas: ${unknown.join(', ')}. Disponíveis: ${spec.steps.map((step) => step.id).join(', ')}` };
      }
      return runSteps(ctx, steps);
    },
  };
}

export interface MenuSpec {
  id: string;
  title: string;
  description: string;
  group: string;
  icon?: string;
  keywords?: string[];
  children: Command[];
}

/** Cria um comando do tipo menu. Em modo headless lista os filhos. */
export function menu(spec: MenuSpec): Command {
  return {
    ...spec,
    kind: 'menu',
    async run(ctx) {
      ctx.report.info(`"${spec.title}" é um menu. Escolha uma das ações:`);
      for (const child of spec.children) ctx.report.detail(`${child.id.padEnd(18)} ${child.description}`);
      return { status: 'warn', summary: 'Nenhuma ação executada' };
    },
  };
}
