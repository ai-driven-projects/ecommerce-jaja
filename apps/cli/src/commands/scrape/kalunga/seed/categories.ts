import { Alias } from '@mentoria-360/shared';
import type { CategoryFile, ScrapedProduct } from '../types.js';
import type { CategorySeedItem } from './types.js';

/** Categoria da árvore planejada; `slug` é preenchido ao resolver as colisões. */
interface PlannedCategory {
  name: string;
  sourceSlug: string;
  order: number;
  isHighlighted: boolean;
  parent: PlannedCategory | null;
  slug: string;
}

interface PlannedRoot extends PlannedCategory {
  products: ScrapedProduct[];
  listedGroups: PlannedCategory[];
  createdGroups: PlannedCategory[];
  /** Grupos listados pelo nome sem espaços nas pontas; vale a primeira ocorrência. */
  groupsByName: Map<string, PlannedCategory>;
}

/** Categoria de um produto a partir dos nomes departamento → grupo → subgrupo. `fallback`: caiu no departamento. */
export type CategoryLookup = (department: string, group: string, subgroup: string) => { slug: string; fallback: boolean } | null;

export interface CategoryTree {
  categories: CategorySeedItem[];
  lookup: CategoryLookup;
  counts: { roots: number; listedGroups: number; createdGroups: number; subgroups: number };
}

function planned(name: string, sourceSlug: string, order: number, isHighlighted: boolean, parent: PlannedCategory | null): PlannedCategory {
  return { name, sourceSlug, order, isHighlighted, parent, slug: '' };
}

function byName(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR');
}

/** Monta a árvore em memória: uma raiz por arquivo, os grupos do próprio departamento e os subgrupos citados nos produtos. */
function planTree(files: CategoryFile[]) {
  const roots: PlannedRoot[] = files.map((file) => {
    const department = file.category;
    const root: PlannedRoot = {
      ...planned(department.name.trim(), department.slug, department.order, false, null),
      products: file.products,
      listedGroups: [],
      createdGroups: [],
      groupsByName: new Map(),
    };
    // `groups` mistura grupos de outros departamentos; aqui entram só os do próprio.
    root.listedGroups = department.groups
      .filter((group) => group.departmentId === department.id)
      .map((group, index) => planned(group.name.trim(), group.slug, index, group.highlighted, root));
    for (const group of root.listedGroups) {
      if (!root.groupsByName.has(group.name)) root.groupsByName.set(group.name, group);
    }
    return root;
  });

  // Grupos citados por produtos que nenhuma raiz possui: criados uma vez, pelo nome.
  const createdByName = new Map<string, PlannedCategory>();
  const subgroupNames = new Map<PlannedCategory, Set<string>>();

  const ownerGroup = (fileRoot: PlannedRoot, groupName: string): PlannedCategory => {
    const owned =
      fileRoot.groupsByName.get(groupName) ??
      roots.find((root) => root.groupsByName.has(groupName))?.groupsByName.get(groupName) ??
      createdByName.get(groupName);
    if (owned) return owned;
    const created = planned(groupName, '', 0, false, fileRoot);
    createdByName.set(groupName, created);
    fileRoot.createdGroups.push(created);
    return created;
  };

  for (const root of roots) {
    for (const product of root.products) {
      const groupName = product.category.group?.trim();
      const subgroupName = product.category.subgroup?.trim();
      if (!groupName || !subgroupName || subgroupName === groupName) continue;
      const group = ownerGroup(root, groupName);
      const names = subgroupNames.get(group) ?? new Set<string>();
      names.add(subgroupName);
      subgroupNames.set(group, names);
    }
  }

  // Grupos criados vêm depois dos listados, em ordem alfabética.
  for (const root of roots) {
    root.createdGroups.sort((a, b) => byName(a.name, b.name));
    root.createdGroups.forEach((group, index) => {
      group.order = root.listedGroups.length + index;
    });
  }

  const listedGroups = roots.flatMap((root) => root.listedGroups);
  const createdGroups = roots.flatMap((root) => root.createdGroups);
  // Subgrupos distintos por grupo, em ordem alfabética, seguindo a ordem dos grupos.
  const subgroups = [...listedGroups, ...createdGroups].flatMap((group) =>
    [...(subgroupNames.get(group) ?? [])].sort(byName).map((name, index) => planned(name, '', index, false, group)),
  );

  return { roots, listedGroups, createdGroups, subgroups };
}

/**
 * Resolve os slugs numa ordem fixa (raízes → grupos listados → grupos criados → subgrupos), só com a
 * árvore, para que cada geração dê os mesmos slugs. Slug já usado vira `<slug-pai>-<slug>`.
 */
function resolveSlugs(ordered: PlannedCategory[]): void {
  const used = new Set<string>();
  for (const category of ordered) {
    const base = Alias.format(category.sourceSlug || category.name);
    const slug = used.has(base) && category.parent ? `${category.parent.slug}-${base}` : base;
    if (!slug || used.has(slug)) throw new Error(`Não foi possível gerar um slug único para a categoria "${category.name}" (tentou "${slug}")`);
    used.add(slug);
    category.slug = slug;
  }
}

/**
 * Busca por nome, como o site classifica os produtos. Um grupo que não está sob o departamento é
 * procurado sob as outras raízes, na ordem delas; o que não for encontrado cai no departamento.
 */
function createLookup(categories: PlannedCategory[]): CategoryLookup {
  const sorted = [...categories].sort((a, b) => a.order - b.order || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const roots = new Map<string, PlannedCategory>();
  const childrenByName = new Map<PlannedCategory, Map<string, PlannedCategory>>();

  for (const category of sorted) {
    if (!category.parent) {
      if (!roots.has(category.name)) roots.set(category.name, category);
      continue;
    }
    const children = childrenByName.get(category.parent) ?? new Map<string, PlannedCategory>();
    if (!children.has(category.name)) children.set(category.name, category);
    childrenByName.set(category.parent, children);
  }

  const rootList = [...roots.values()];
  return (department, group, subgroup) => {
    const root = roots.get(department);
    if (!root) return null;
    const groupCategory = childrenByName.get(root)?.get(group) ?? rootList.map((item) => childrenByName.get(item)?.get(group)).find(Boolean);
    if (!group || !groupCategory) return { slug: root.slug, fallback: true };
    // Subgrupo com o mesmo nome do grupo: o produto pertence ao grupo.
    if (!subgroup || subgroup === group) return { slug: groupCategory.slug, fallback: false };
    const subgroupCategory = childrenByName.get(groupCategory)?.get(subgroup);
    return subgroupCategory ? { slug: subgroupCategory.slug, fallback: false } : { slug: root.slug, fallback: true };
  };
}

/** Árvore de categorias (departamento → grupo → subgrupo) no formato do seed, com a busca usada pelos produtos. */
export function buildCategories(files: CategoryFile[]): CategoryTree {
  const { roots, listedGroups, createdGroups, subgroups } = planTree(files);
  const ordered = [...roots, ...listedGroups, ...createdGroups, ...subgroups];
  resolveSlugs(ordered);

  return {
    categories: ordered.map((category) => ({
      name: category.name,
      slug: category.slug,
      parentSlug: category.parent?.slug ?? null,
      description: null,
      order: category.order,
      isHighlighted: category.isHighlighted,
      imageUrl: null,
      isActive: true,
    })),
    lookup: createLookup(ordered),
    counts: { roots: roots.length, listedGroups: listedGroups.length, createdGroups: createdGroups.length, subgroups: subgroups.length },
  };
}
