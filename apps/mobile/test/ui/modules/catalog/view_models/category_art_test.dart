import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/ui/modules/catalog/view_models/category_art.dart';
import 'package:mobile/ui/shared/widgets/product_art.dart';

void main() {
  test('coffee-break é ☕ sobre o pêssego', () {
    expect(
      categoryArtOf('coffee-break'),
      const CategoryArt(emoji: '☕', tint: ProductArtTint.peach),
    );
  });

  test('papeis-pastas é 📄 sobre o azul', () {
    expect(
      categoryArtOf('papeis-pastas'),
      const CategoryArt(emoji: '📄', tint: ProductArtTint.blue),
    );
  });

  test('raiz desconhecida é 🛒 sobre o verde', () {
    final art = categoryArtOf('nao-existe');

    expect(art, const CategoryArt(emoji: '🛒', tint: ProductArtTint.green));
    expect(art, same(defaultCategoryArt));
  });

  test('as doze raízes do catálogo têm ilustração própria', () {
    const roots = {
      'artes-pintura': ('🎨', ProductArtTint.purple),
      'cartuchos-toners': ('🖨️', ProductArtTint.blue),
      'coffee-break': ('☕', ProductArtTint.peach),
      'cuidados-pessoais': ('🧴', ProductArtTint.mint),
      'envelopes-etiquetas-formularios': ('✉️', ProductArtTint.yellow),
      'escolar': ('🎒', ProductArtTint.green),
      'escrita-corretivos': ('✏️', ProductArtTint.yellow),
      'escritorio': ('📎', ProductArtTint.peach),
      'higiene-limpeza': ('🧽', ProductArtTint.mint),
      'informatica': ('💻', ProductArtTint.purple),
      'organizacao': ('🗂️', ProductArtTint.green),
      'papeis-pastas': ('📄', ProductArtTint.blue),
    };

    for (final MapEntry(key: slug, value: (emoji, tint)) in roots.entries) {
      expect(categoryArtOf(slug), CategoryArt(emoji: emoji, tint: tint));
    }
  });
}
