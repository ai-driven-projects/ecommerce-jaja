/**
 * O plano mestre de um loop (`openspec/loops/<nome>/plano.md`), em português porque é lido por pessoas:
 *
 *   # <título>
 *   ## Objetivo
 *   ## Regras            ← vão para o prompt de sistema de todas as sessões do loop
 *   ## Fase 1 · <nome>
 *   1. **<título>** · `<loop>-01-<assunto>` — <descrição, pode continuar nas linhas seguintes>
 *   2. **<título>** · `<change-que-ja-existe>` · spec pronta — <descrição>   ← só aplica, sem propor
 *   ## Fora do escopo
 *
 * Gerar padronizado (renderPlan), carregar flexível (parsePlan aceita seções
 * ausentes e texto livre entre as etapas).
 */
import { twoDigits } from './format.js';

export interface PlanStage {
  number: number;
  phase: string;
  title: string;
  change: string;
  description: string;
  /** A change já existia quando o loop foi criado: o loop a aplica sem propor. */
  readySpec?: boolean;
}

export interface PlanPhase {
  number: number;
  name: string;
  stages: PlanStage[];
}

export interface Plan {
  title: string;
  goal: string;
  rules: string;
  outOfScope: string;
  phases: PlanPhase[];
  /** Etapas escritas antes da primeira fase (inválidas, mas lidas para apontar o erro). */
  loose: PlanStage[];
}

const PHASE = /^## Fase (\d+) · (.+)$/;
const STAGE = /^(\d+)\. \*\*(.+?)\*\*(?: · `([^`]*)`)?( · spec pronta)?(?:\s*—\s*(.*))?$/;
const READY_SPEC_MARK = ' · spec pronta';

const sectionOf = (title: string): 'goal' | 'rules' | 'out' | undefined => {
  const t = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  if (t === 'objetivo') return 'goal';
  if (t === 'regras' || t === 'regras do loop') return 'rules';
  if (t === 'fora do escopo' || t.startsWith('fora do')) return 'out';
  return undefined;
};

export function parsePlan(text: string): Plan {
  const plan: Plan = { title: '', goal: '', rules: '', outOfScope: '', phases: [], loose: [] };
  const texts = { goal: [] as string[], rules: [] as string[], out: [] as string[], intro: [] as string[] };
  let section: keyof typeof texts | 'phase' | 'other' = 'intro';
  let phase: PlanPhase | undefined;
  let stage: PlanStage | undefined;

  for (const line of text.split('\n')) {
    const title = line.match(/^# (.+)$/);
    if (title?.[1] && !plan.title) {
      plan.title = title[1].trim();
      continue;
    }
    const p = line.match(PHASE);
    if (p) {
      phase = { number: Number(p[1]), name: (p[2] ?? '').trim(), stages: [] };
      plan.phases.push(phase);
      section = 'phase';
      stage = undefined;
      continue;
    }
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      section = sectionOf(h2[1] ?? '') ?? 'other';
      stage = undefined;
      continue;
    }
    if (section === 'phase' || (section === 'intro' && STAGE.test(line))) {
      const s = line.match(STAGE);
      if (s) {
        stage = {
          number: Number(s[1]),
          phase: phase?.name ?? '',
          title: (s[2] ?? '').replace(/,$/, '').trim(),
          change: (s[3] ?? '').trim(),
          description: (s[5] ?? '').trim(),
        };
        if (s[4]) stage.readySpec = true;
        if (phase) phase.stages.push(stage);
        else plan.loose.push(stage);
        continue;
      }
      // continuação da descrição da etapa (linhas recuadas)
      if (stage && /^\s+\S/.test(line)) {
        stage.description = `${stage.description} ${line.trim()}`.trim();
        continue;
      }
      if (!line.trim()) stage = undefined;
      continue;
    }
    if (section !== 'other') texts[section].push(line);
  }
  const join = (lines: string[]) => lines.join('\n').trim();
  plan.goal = join(texts.goal) || join(texts.intro);
  plan.rules = join(texts.rules);
  plan.outOfScope = join(texts.out);
  return plan;
}

export const planStages = (plan: Plan): PlanStage[] => plan.phases.flatMap((phase) => phase.stages);

/** `<loop>-NN-<assunto>` com NN igual ao número da etapa. */
export function expectedChange(loopName: string, number: number): RegExp {
  const escaped = loopName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}-${twoDigits(number)}-[a-z0-9]+(-[a-z0-9]+)*$`);
}

/**
 * A etapa aplica uma change que já existia quando o loop foi criado (marcada
 * `spec pronta` no plano): o loop não a propõe, só a aplica. A marca é explícita
 * porque o nome sozinho não diz nada: uma spec pronta pode seguir o padrão do loop.
 */
export const usesReadySpec = (stage: { readySpec?: boolean }) => !!stage.readySpec;

/**
 * Problemas que impedem aprovar o plano. Vazio = válido. Uma spec pronta pode ter
 * qualquer nome, mas precisa existir no OpenSpec (conferido com `exists`).
 */
export function validatePlan(plan: Plan, loopName: string, exists?: (change: string) => boolean): string[] {
  const problems: string[] = [];
  for (const stage of plan.loose) problems.push(`etapa ${stage.number} está fora de uma fase ("## Fase N · nome")`);
  const stages = planStages(plan);
  if (!stages.length)
    problems.push('o plano não tem etapas (formato: 1. **Título** · `<loop>-01-assunto` — descrição)');
  const seen = new Set<string>();
  stages.forEach((stage, index) => {
    if (stage.number !== index + 1) problems.push(`etapa ${stage.number} fora de sequência: esperava ${index + 1}`);
    if (!stage.change) problems.push(`etapa ${stage.number} sem nome de change`);
    else if (stage.readySpec) {
      if (exists && !exists(stage.change))
        problems.push(`etapa ${stage.number}: a spec pronta "${stage.change}" não existe em openspec/changes`);
    } else if (!expectedChange(loopName, index + 1).test(stage.change)) {
      problems.push(
        `etapa ${stage.number}: change "${stage.change}" fora do padrão ${loopName}-${twoDigits(index + 1)}-<assunto>`,
      );
    }
    if (stage.change && seen.has(stage.change))
      problems.push(`etapa ${stage.number}: change "${stage.change}" repetida`);
    seen.add(stage.change);
    if (!stage.title) problems.push(`etapa ${stage.number} sem título`);
  });
  return problems;
}

/** Texto padronizado do plano. `parsePlan(renderPlan(p))` devolve o mesmo plano. */
export function renderPlan(plan: Omit<Plan, 'loose'>): string {
  const parts = [`# ${plan.title}`, '', '## Objetivo', '', plan.goal.trim(), ''];
  parts.push('## Regras', '', plan.rules.trim() || 'Nenhuma regra além das gerais do loop.', '');
  for (const phase of plan.phases) {
    parts.push(`## Fase ${phase.number} · ${phase.name}`, '');
    for (const stage of phase.stages) {
      const description = stage.description.trim().replace(/\s+/g, ' ');
      parts.push(
        `${stage.number}. **${stage.title}** · \`${stage.change}\`${stage.readySpec ? READY_SPEC_MARK : ''}${description ? ` — ${description}` : ''}`,
      );
    }
    parts.push('');
  }
  if (plan.outOfScope.trim()) parts.push('## Fora do escopo', '', plan.outOfScope.trim(), '');
  return parts.join('\n');
}
