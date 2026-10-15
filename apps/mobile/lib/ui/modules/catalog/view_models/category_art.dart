import '../../../shared/widgets/product_art.dart';

/// Ilustração de reserva de uma categoria raiz: o emoji e o tom pastel da
/// área de imagem, dos chips e dos cartões de categoria.
class CategoryArt {
  const CategoryArt({required this.emoji, required this.tint});

  final String emoji;
  final ProductArtTint tint;

  @override
  bool operator ==(Object other) =>
      other is CategoryArt && other.emoji == emoji && other.tint == tint;

  @override
  int get hashCode => Object.hash(emoji, tint);

  @override
  String toString() => 'CategoryArt($emoji, ${tint.name})';
}

/// Raiz sem ilustração própria (`DEFAULT_CATEGORY_ART` do web).
const defaultCategoryArt = CategoryArt(
  emoji: ProductArt.defaultEmoji,
  tint: ProductArtTint.green,
);

// As raízes do catálogo, por slug, de
// `apps/frontend/src/shared/components/store/category-art.ts`. As chaves do
// catálogo local do web (carrinho e dashboards) não existem no app.
const _artByRootSlug = <String, CategoryArt>{
  'artes-pintura': CategoryArt(emoji: '🎨', tint: ProductArtTint.purple),
  'cartuchos-toners': CategoryArt(emoji: '🖨️', tint: ProductArtTint.blue),
  'coffee-break': CategoryArt(emoji: '☕', tint: ProductArtTint.peach),
  'cuidados-pessoais': CategoryArt(emoji: '🧴', tint: ProductArtTint.mint),
  'envelopes-etiquetas-formularios': CategoryArt(
    emoji: '✉️',
    tint: ProductArtTint.yellow,
  ),
  'escolar': CategoryArt(emoji: '🎒', tint: ProductArtTint.green),
  'escrita-corretivos': CategoryArt(emoji: '✏️', tint: ProductArtTint.yellow),
  'escritorio': CategoryArt(emoji: '📎', tint: ProductArtTint.peach),
  'higiene-limpeza': CategoryArt(emoji: '🧽', tint: ProductArtTint.mint),
  'informatica': CategoryArt(emoji: '💻', tint: ProductArtTint.purple),
  'organizacao': CategoryArt(emoji: '🗂️', tint: ProductArtTint.green),
  'papeis-pastas': CategoryArt(emoji: '📄', tint: ProductArtTint.blue),
};

/// A ilustração da raiz [rootSlug], ou [defaultCategoryArt] se desconhecida.
CategoryArt categoryArtOf(String rootSlug) =>
    _artByRootSlug[rootSlug] ?? defaultCategoryArt;
