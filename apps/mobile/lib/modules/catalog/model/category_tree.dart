import 'category_entity.dart';

/// Caminho da raiz até a categoria [slug] (inclusive); vazio quando o slug
/// não existe. Cópia de `categoryTrail` em
/// `apps/frontend/src/modules/catalog/data/storefront-category.util.ts`.
List<Category> categoryTrail(List<Category> tree, String slug) {
  for (final node in tree) {
    if (node.slug == slug) return List.unmodifiable([node]);
    final trail = categoryTrail(node.children, slug);
    if (trail.isNotEmpty) return List.unmodifiable([node, ...trail]);
  }
  return const [];
}

/// A árvore achatada em pré-ordem (cada nó e, depois, as descendentes dele,
/// na ordem da API); o recuo de cada linha vem de [Category.level].
List<Category> flattenCategoryTree(List<Category> tree) {
  final result = <Category>[];

  void visit(Category node) {
    result.add(node);
    node.children.forEach(visit);
  }

  tree.forEach(visit);
  return List.unmodifiable(result);
}
