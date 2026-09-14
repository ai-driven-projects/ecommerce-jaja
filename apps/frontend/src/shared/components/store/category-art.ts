/**
 * Ilustração de reserva da área de imagem por categoria raiz: emoji e tom
 * pastel. Usada quando o produto não tem foto ou a foto não carrega. As chaves
 * antigas do catálogo local continuam valendo para o carrinho e os dashboards.
 */

export type CategoryArt = {
  emoji: string;
  /** Classe Tailwind do fundo pastel. */
  tintClass: string;
};

const ART_BY_CATEGORY: Readonly<Record<string, CategoryArt>> = {
  // Raízes do catálogo (slug).
  'artes-pintura': { emoji: '🎨', tintClass: 'bg-tint-purple' },
  'cartuchos-toners': { emoji: '🖨️', tintClass: 'bg-tint-blue' },
  'coffee-break': { emoji: '☕', tintClass: 'bg-tint-peach' },
  'cuidados-pessoais': { emoji: '🧴', tintClass: 'bg-tint-mint' },
  'envelopes-etiquetas-formularios': { emoji: '✉️', tintClass: 'bg-tint-yellow' },
  escolar: { emoji: '🎒', tintClass: 'bg-tint-green' },
  'escrita-corretivos': { emoji: '✏️', tintClass: 'bg-tint-yellow' },
  escritorio: { emoji: '📎', tintClass: 'bg-tint-peach' },
  'higiene-limpeza': { emoji: '🧽', tintClass: 'bg-tint-mint' },
  informatica: { emoji: '💻', tintClass: 'bg-tint-purple' },
  organizacao: { emoji: '🗂️', tintClass: 'bg-tint-green' },
  'papeis-pastas': { emoji: '📄', tintClass: 'bg-tint-blue' },
  // Chaves do catálogo local (carrinho e dashboards).
  papelaria: { emoji: '✏️', tintClass: 'bg-tint-yellow' },
  impressão: { emoji: '🖨️', tintClass: 'bg-tint-blue' },
  'café e lanches': { emoji: '☕', tintClass: 'bg-tint-peach' },
  'limpeza de escritório': { emoji: '🧽', tintClass: 'bg-tint-mint' },
  'tecnologia básica': { emoji: '💻', tintClass: 'bg-tint-purple' },
};

/** Categoria sem ilustração própria. */
export const DEFAULT_CATEGORY_ART: CategoryArt = { emoji: '🛒', tintClass: 'bg-tint-green' };

export function categoryArt(category: string): CategoryArt {
  return ART_BY_CATEGORY[category] ?? DEFAULT_CATEGORY_ART;
}

export function categoryEmoji(category: string): string {
  return categoryArt(category).emoji;
}

export function categoryTintClass(category: string): string {
  return categoryArt(category).tintClass;
}
