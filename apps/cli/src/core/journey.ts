import type { Command, CommandContext, CommandResult, JourneyArea, JourneyDetection, JourneyStatus, JourneyStep } from './command.js';
import { resolveSelection, runSteps } from './wizard.js';

/** Seleção especial: "todos os passos ainda não feitos". */
export const PENDING_SELECTION = '@pending';
/** Seleção especial: "a sequência de publicação" (passos com `publish`). */
export const PUBLISH_SELECTION = '@publish';
/** Prefixo das seleções de área: `@cicd` escolhe todos os passos da área `cicd`. */
export const AREA_PREFIX = '@';

// Sem círculos: na tela, ● e ○ são a seleção.
export const JOURNEY_ICON: Record<JourneyStatus, string> = { done: '✔', pending: '–', attention: '▲', unknown: '?' };
export const JOURNEY_LABEL: Record<JourneyStatus, string> = { done: 'feito', pending: 'pendente', attention: 'atenção', unknown: 'não verificado' };

export type DetectionMap = Map<string, JourneyDetection>;

/** Detecta o estado de todos os passos em paralelo; exceções viram `unknown`. */
export async function detectAll(ctx: CommandContext, steps: JourneyStep[]): Promise<DetectionMap> {
  const entries = await Promise.all(
    steps.map(async (step): Promise<[string, JourneyDetection]> => {
      try {
        return [step.id, await step.detect(ctx)];
      } catch (error) {
        return [step.id, { status: 'unknown', detail: error instanceof Error ? error.message : String(error) }];
      }
    }),
  );
  return new Map(entries);
}

/** Ids dos passos não concluídos (pendentes, com atenção ou não verificados), na ordem da jornada. */
export function pendingIds(steps: JourneyStep[], detections?: DetectionMap): string[] {
  return steps.filter((step) => detections?.get(step.id)?.status !== 'done').map((step) => step.id);
}

/** Traduz seleções especiais (`@pending`, `@publish`, `@<área>`) em ids de passos, dado o estado detectado. */
export function expandSelection(steps: JourneyStep[], selection: string[], detections?: DetectionMap): string[] {
  const ids: string[] = [];
  for (const item of selection) {
    const inArea = steps.filter((step) => step.area && `${AREA_PREFIX}${step.area}` === item);
    if (item === PENDING_SELECTION) ids.push(...pendingIds(steps, detections));
    else if (item === PUBLISH_SELECTION) ids.push(...steps.filter((step) => step.publish).map((step) => step.id));
    else if (inArea.length > 0) ids.push(...inArea.map((step) => step.id));
    else ids.push(item);
  }
  return [...new Set(ids)];
}

/** Nome da área do passo, usado como prefixo na lista; vazio quando o passo não tem área declarada. */
export function areaLabel(step: JourneyStep, areas: JourneyArea[] = []): string {
  return areas.find((area) => area.id === step.area)?.label ?? '';
}

/** Marca todos os ids quando falta algum; desmarca todos quando já estão marcados. */
export function toggleMany(marked: ReadonlySet<string>, ids: string[]): Set<string> {
  const next = new Set(marked);
  const allMarked = ids.every((id) => next.has(id));
  for (const id of ids) {
    if (allMarked) next.delete(id);
    else next.add(id);
  }
  return next;
}

function reportChecklist(ctx: CommandContext, steps: JourneyStep[], areas: JourneyArea[] | undefined, detections: DetectionMap): void {
  steps.forEach((step, index) => {
    const detection = detections.get(step.id) ?? { status: 'unknown' as JourneyStatus };
    const area = areaLabel(step, areas);
    const line = `${index + 1}. ${area ? `${area} · ` : ''}${step.label} — ${JOURNEY_LABEL[detection.status]}${detection.detail ? ` (${detection.detail})` : ''}`;
    if (detection.status === 'done') ctx.report.success(line);
    else if (detection.status === 'attention') ctx.report.warn(line);
    else if (detection.status === 'pending') ctx.report.info(line);
    else ctx.report.detail(`? ${line}`);
  });
}

export interface JourneySpec {
  id: string;
  title: string;
  description: string;
  group: string;
  icon?: string;
  keywords?: string[];
  areas?: JourneyArea[];
  steps: JourneyStep[];
}

/**
 * Comando do tipo jornada. Sem seleção mostra a checklist com estados; com seleção
 * (ids, `@<área>`, `@pending` ou `@publish`) executa os passos em ordem, incluindo dependências.
 */
export function journey(spec: JourneySpec): Command {
  return {
    ...spec,
    kind: 'journey',
    async run(ctx): Promise<CommandResult> {
      const needsDetection = !ctx.selection || ctx.selection.includes(PENDING_SELECTION);
      const detections = needsDetection ? await detectAll(ctx, spec.steps) : undefined;
      if (!ctx.selection) {
        reportChecklist(ctx, spec.steps, spec.areas, detections as DetectionMap);
        const pending = pendingIds(spec.steps, detections).length;
        ctx.report.detail(`Rode com --pending para executar os ${pending} passo(s) não concluído(s), --steps <ids ou @área> para escolher, ou --all.`);
        return pending === 0 ? { status: 'ok', summary: 'Tudo configurado' } : { status: 'warn', summary: `${pending} passo(s) pendente(s)` };
      }
      const wanted = expandSelection(spec.steps, ctx.selection, detections);
      const unknown = wanted.filter((id) => !spec.steps.some((step) => step.id === id));
      if (unknown.length > 0) {
        const areaIds = (spec.areas ?? []).map((area) => `${AREA_PREFIX}${area.id}`);
        const available = `Disponíveis: ${spec.steps.map((step) => step.id).join(', ')}${areaIds.length > 0 ? `; áreas: ${areaIds.join(', ')}` : ''}`;
        return { status: 'error', summary: `Passos desconhecidos: ${unknown.join(', ')}. ${available}` };
      }
      if (wanted.length === 0) return { status: 'ok', summary: 'Nenhum passo pendente' };
      const { steps, added } = resolveSelection(spec.steps, wanted);
      if (added.length > 0) ctx.report.info(`Incluídos por dependência: ${added.join(', ')}`);
      return runSteps(ctx, steps);
    },
  };
}
