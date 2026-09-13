import type { KalungaGroup, ListedProduct } from './types.js';

/** Faixas oferecidas ao usuário: quantidade alvo de produtos por categoria. */
export interface ProductRange {
  id: string;
  label: string;
  min: number;
  max: number;
}

export const PRODUCT_RANGES: ProductRange[] = [
  { id: '25', label: 'Até 25 produtos', min: 10, max: 25 },
  { id: '50', label: 'Até 50 produtos', min: 25, max: 50 },
  { id: '50-100', label: 'De 50 a 100 produtos', min: 50, max: 100 },
  { id: '100-200', label: 'De 100 a 200 produtos', min: 100, max: 200 },
  { id: '200-500', label: 'De 200 a 500 produtos', min: 200, max: 500 },
];

/** "50-100" → faixa; "80" → faixa fixa; id de uma faixa conhecida → ela. */
export function parseRange(text: string): ProductRange | null {
  const value = text.trim().toLowerCase();
  const known = PRODUCT_RANGES.find((range) => range.id === value);
  if (known) return known;
  const pair = value.match(/^(\d+)\s*[-a]\s*(\d+)$/);
  if (pair) {
    const min = Number(pair[1]);
    const max = Number(pair[2]);
    if (min > 0 && max >= min) return { id: value, label: `De ${min} a ${max} produtos`, min, max };
  }
  const single = value.match(/^(\d+)$/);
  if (single && Number(single[1]) > 0) return { id: value, label: `${single[1]} produtos`, min: Number(single[1]), max: Number(single[1]) };
  return null;
}

/** `count` índices espalhados uniformemente em `[0, total)`, para amostrar grupos ao longo de toda a lista. */
export function spreadIndexes(total: number, count: number): number[] {
  if (total <= 0 || count <= 0) return [];
  if (count >= total) return Array.from({ length: total }, (_, index) => index);
  const step = total / count;
  const chosen = new Set<number>();
  for (let index = 0; index < count; index += 1) chosen.add(Math.min(total - 1, Math.floor(index * step + step / 2)));
  return [...chosen].sort((a, b) => a - b);
}

export interface SamplingPlan {
  target: number;
  perGroup: number;
  /** Grupos na ordem em que serão consultados: primeiro os espalhados, depois os restantes como reserva. */
  groups: KalungaGroup[];
  sampledGroups: number;
}

/**
 * Para ter um "intervalo interessante" de produtos, a categoria é amostrada em vários grupos:
 * `perGroup` produtos dos mais vendidos de cada grupo, em grupos espalhados pela lista do departamento.
 * Grupos de destaque entram primeiro. Os grupos não amostrados ficam de reserva para completar o alvo.
 */
export function planSampling(groups: KalungaGroup[], target: number, perGroup = 5): SamplingPlan {
  const highlighted = groups.filter((group) => group.highlighted);
  const rest = groups.filter((group) => !group.highlighted);
  const needed = Math.ceil(target / perGroup);
  const fromHighlighted = highlighted.slice(0, needed);
  const picked = new Set(spreadIndexes(rest.length, Math.max(0, needed - fromHighlighted.length)));
  const sampled = [...fromHighlighted, ...rest.filter((_, index) => picked.has(index))];
  const reserve = [...rest.filter((_, index) => !picked.has(index)), ...highlighted.slice(needed)];
  return { target, perGroup, groups: [...sampled, ...reserve], sampledGroups: sampled.length };
}

/** Junta páginas de vários grupos respeitando `perGroup` por rodada, sem repetir produtos, até o alvo. */
export function takeRound(collected: Map<string, ListedProduct>, candidates: ListedProduct[], perGroup: number, target: number): ListedProduct[] {
  const added: ListedProduct[] = [];
  for (const product of candidates) {
    if (collected.size >= target || added.length >= perGroup) break;
    if (collected.has(product.id)) continue;
    collected.set(product.id, product);
    added.push(product);
  }
  return added;
}
