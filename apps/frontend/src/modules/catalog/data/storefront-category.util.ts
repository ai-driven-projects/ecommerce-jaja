import type { StorefrontCategory } from './storefront.api';

/** Categoria da árvore pelo slug, em qualquer nível; `null` quando não existe. */
export function findCategoryBySlug(tree: readonly StorefrontCategory[], slug: string): StorefrontCategory | null {
  return categoryTrail(tree, slug).at(-1) ?? null;
}

/** Caminho da raiz até a categoria (inclusive); vazio quando o slug não existe. */
export function categoryTrail(tree: readonly StorefrontCategory[], slug: string): StorefrontCategory[] {
  for (const node of tree) {
    if (node.slug === slug) return [node];
    const trail = categoryTrail(node.children, slug);
    if (trail.length > 0) return [node, ...trail];
  }
  return [];
}

/** Categorias marcadas como destaque, em pré-ordem, com o slug da raiz de cada uma. */
export function highlightedCategories(
  tree: readonly StorefrontCategory[],
  limit: number,
): Array<{ category: StorefrontCategory; rootSlug: string }> {
  const result: Array<{ category: StorefrontCategory; rootSlug: string }> = [];

  const visit = (node: StorefrontCategory, rootSlug: string) => {
    if (result.length >= limit) return;
    if (node.isHighlighted && node.productCount > 0) result.push({ category: node, rootSlug });
    node.children.forEach((child) => visit(child, rootSlug));
  };

  tree.forEach((root) => visit(root, root.slug));
  return result;
}
