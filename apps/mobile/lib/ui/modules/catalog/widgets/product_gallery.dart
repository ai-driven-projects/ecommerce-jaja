import 'package:flutter/material.dart';

import '../../../../modules/catalog/model/product_detail.dart';
import '../../../../modules/catalog/model/product_detail_entity.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/product_art.dart';
import '../view_models/category_art.dart';

/// Galeria de fotos do detalhe, de `product-gallery.component.tsx`: área
/// quadrada com a foto grande, deslizável. Com duas ou mais fotos, o contador
/// "n/total" no canto e a faixa de miniaturas (a ativa com borda laranja);
/// tocar numa miniatura leva a ela. Sem as setas do web: deslizar é o gesto do
/// app. Sem fotos, o emoji e o tom da categoria raiz.
///
/// Quem a usa passa `key: ValueKey(product.slug)`, como o `key` do web: outro
/// produto começa da primeira foto.
class ProductGallery extends StatefulWidget {
  const ProductGallery({super.key, required this.product});

  /// Lado da miniatura (`h-[72px] w-[72px]`).
  static const double thumbSize = 72;

  /// Duração da troca de foto ao tocar numa miniatura.
  static const Duration pageDuration = Duration(milliseconds: 250);

  static String counterLabel(int current, int total) => '$current/$total';

  static String thumbLabel(int number, int total) => 'Imagem $number de $total';

  final ProductDetail product;

  @override
  State<ProductGallery> createState() => _ProductGalleryState();
}

class _ProductGalleryState extends State<ProductGallery> {
  final _controller = PageController();
  late List<GlobalKey> _thumbKeys;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    _thumbKeys = [for (final _ in widget.product.images) GlobalKey()];
  }

  @override
  void didUpdateWidget(ProductGallery oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.product.images.length != widget.product.images.length) {
      _thumbKeys = [for (final _ in widget.product.images) GlobalKey()];
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onPageChanged(int index) {
    setState(() => _index = index);
    final thumbContext = _thumbKeys[index].currentContext;
    if (thumbContext != null) {
      Scrollable.ensureVisible(
        thumbContext,
        duration: ProductGallery.pageDuration,
        alignment: 0.5,
      );
    }
  }

  void _openImage(int index) {
    _controller.animateToPage(
      index,
      duration: ProductGallery.pageDuration,
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final images = widget.product.images;
    final art = categoryArtOf(rootCategorySlugOf(widget.product));
    final total = images.length;
    final many = total > 1;

    final Widget area;
    if (images.isEmpty) {
      area = ProductArt(
        size: ProductArtSize.gallery,
        emoji: art.emoji,
        tint: art.tint,
      );
    } else {
      area = PageView.builder(
        controller: _controller,
        itemCount: total,
        onPageChanged: _onPageChanged,
        itemBuilder: (_, index) => ProductArt(
          size: ProductArtSize.gallery,
          imageUrl: images[index].largeUrl,
          emoji: art.emoji,
          tint: art.tint,
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AspectRatio(
          aspectRatio: 1,
          child: Stack(
            fit: StackFit.expand,
            children: [
              area,
              if (many)
                Positioned(
                  right: AppSpacing.s12,
                  bottom: AppSpacing.s12,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: tokens.card,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.s10,
                        vertical: AppSpacing.s4,
                      ),
                      child: Semantics(
                        liveRegion: true,
                        child: Text(
                          ProductGallery.counterLabel(_index + 1, total),
                          style: textTheme.chipCount.copyWith(
                            color: tokens.ink,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (many) ...[
          const SizedBox(height: AppSpacing.s12),
          SizedBox(
            height: ProductGallery.thumbSize,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: total,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.s8),
              itemBuilder: (_, index) => _Thumb(
                key: _thumbKeys[index],
                label: ProductGallery.thumbLabel(index + 1, total),
                active: index == _index,
                onTap: () => _openImage(index),
                child: ProductArt(
                  size: ProductArtSize.thumb,
                  imageUrl: images[index].thumbUrl,
                  emoji: art.emoji,
                  tint: art.tint,
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Miniatura da faixa (`rounded-xl border-2 p-1` do web), anunciada como
/// botão e, a ativa, como selecionada.
class _Thumb extends StatelessWidget {
  const _Thumb({
    super.key,
    required this.label,
    required this.active,
    required this.onTap,
    required this.child,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Semantics(
      container: true,
      button: true,
      selected: active,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          width: ProductGallery.thumbSize,
          height: ProductGallery.thumbSize,
          padding: const EdgeInsets.all(AppSpacing.s4),
          decoration: BoxDecoration(
            color: tokens.card,
            border: Border.all(
              color: active ? tokens.brand : Colors.transparent,
              width: 2,
            ),
            borderRadius: BorderRadius.circular(AppRadius.xl),
          ),
          child: child,
        ),
      ),
    );
  }
}
