import type { CatalogCategoryNode } from './category.api';

/** Linha de uma categoria na árvore. */
export type CategoryTreeCategoryRow = {
  kind: 'category';
  node: CatalogCategoryNode;
  /** O nó tem filhas (`childrenCount > 0`) e mostra o controle expandir/recolher. */
  hasChildren: boolean;
  /** Filhas visíveis logo abaixo (ou "Carregando…" enquanto chegam). */
  expanded: boolean;
};

/** Linha "Carregando…" sob um nó cujas filhas estão sendo buscadas. */
export type CategoryTreeLoadingRow = {
  kind: 'loading';
  /** Id do nó em carregamento. */
  parentId: string;
  /** Nível das filhas que vão aparecer (recuo da linha). */
  level: number;
};

export type CategoryTreeRow = CategoryTreeCategoryRow | CategoryTreeLoadingRow;

/**
 * Estado de exibição da árvore. Na árvore expandida (a subárvore veio da API)
 * informe `collapsedIds`: todo nó começa aberto. Na recolhida informe
 * `expandedIds`, o cache `childrenById` com as filhas já buscadas e
 * `loadingIds` com os nós em carregamento.
 */
export type CategoryTreeViewState =
  | { collapsedIds: ReadonlySet<string> }
  | {
      expandedIds: ReadonlySet<string>;
      childrenById: ReadonlyMap<string, readonly CatalogCategoryNode[]>;
      loadingIds: ReadonlySet<string>;
    };

/**
 * Linhas visíveis da árvore em pré-ordem: um nó fechado aparece, mas suas
 * descendentes não. Na árvore recolhida, um nó aberto cujas filhas ainda não
 * chegaram ganha a linha "Carregando…" logo abaixo.
 */
export function flattenCategoryTree(
  nodes: readonly CatalogCategoryNode[],
  state: CategoryTreeViewState,
): CategoryTreeRow[] {
  const rows: CategoryTreeRow[] = [];

  const visit = (list: readonly CatalogCategoryNode[]) => {
    for (const node of list) {
      const hasChildren = node.childrenCount > 0 || node.children.length > 0;

      if ('collapsedIds' in state) {
        const expanded = hasChildren && !state.collapsedIds.has(node.id);
        rows.push({ kind: 'category', node, hasChildren, expanded });
        if (expanded) visit(node.children);
        continue;
      }

      const expanded = hasChildren && state.expandedIds.has(node.id);
      rows.push({ kind: 'category', node, hasChildren, expanded });
      if (!expanded) continue;

      const children = state.childrenById.get(node.id);
      if (children) visit(children);
      else if (state.loadingIds.has(node.id)) rows.push({ kind: 'loading', parentId: node.id, level: node.level + 1 });
    }
  };

  visit(nodes);
  return rows;
}
