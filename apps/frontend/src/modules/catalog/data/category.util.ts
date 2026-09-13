import type { CatalogCategory } from './category.api';

/** Categoria com as filhas já montadas e ordenadas. */
export type CategoryTreeNode = CatalogCategory & {
  children: CategoryTreeNode[];
};

const nameCollator = new Intl.Collator('pt-BR');

/** Irmãs por `order` e, em empate, por nome (pt-BR). */
function compareSiblings(a: CatalogCategory, b: CatalogCategory): number {
  return a.order - b.order || nameCollator.compare(a.name, b.name);
}

/**
 * Agrupa as categorias pelo `parentId`. Categoria cuja pai não está na lista
 * (ex.: lista filtrada) fica sob `null`, como raiz, para não sumir da árvore.
 */
function groupByParent(categories: readonly CatalogCategory[]): Map<string | null, CatalogCategory[]> {
  const ids = new Set(categories.map((category) => category.id));
  const groups = new Map<string | null, CatalogCategory[]>();

  for (const category of categories) {
    const key = category.parentId !== null && ids.has(category.parentId) ? category.parentId : null;
    const siblings = groups.get(key);

    if (siblings) siblings.push(category);
    else groups.set(key, [category]);
  }

  return groups;
}

/**
 * Monta a árvore a partir da lista plana devolvida pela API: raízes no
 * primeiro nível e, em cada nó, as filhas ordenadas por `order` e nome.
 */
export function buildCategoryTree(categories: readonly CatalogCategory[]): CategoryTreeNode[] {
  const groups = groupByParent(categories);

  const build = (parentId: string | null): CategoryTreeNode[] =>
    [...(groups.get(parentId) ?? [])]
      .sort(compareSiblings)
      .map((category) => ({ ...category, children: build(category.id) }));

  return build(null);
}

/** Ids de todas as descendentes (filhas, netas…) da categoria, sem incluí-la. */
export function getDescendantIds(categories: readonly CatalogCategory[], id: string): Set<string> {
  const groups = groupByParent(categories);
  const descendants = new Set<string>();
  const queue = [id];

  for (let index = 0; index < queue.length; index++) {
    for (const child of groups.get(queue[index]) ?? []) {
      if (descendants.has(child.id) || child.id === id) continue;
      descendants.add(child.id);
      queue.push(child.id);
    }
  }

  return descendants;
}

/**
 * Linhas visíveis da árvore em pré-ordem: um nó recolhido aparece, mas suas
 * descendentes não.
 */
export function flattenCategoryTree(
  nodes: readonly CategoryTreeNode[],
  collapsedIds: ReadonlySet<string>,
): CategoryTreeNode[] {
  const rows: CategoryTreeNode[] = [];

  const visit = (list: readonly CategoryTreeNode[]) => {
    for (const node of list) {
      rows.push(node);
      if (node.children.length > 0 && !collapsedIds.has(node.id)) visit(node.children);
    }
  };

  visit(nodes);
  return rows;
}
