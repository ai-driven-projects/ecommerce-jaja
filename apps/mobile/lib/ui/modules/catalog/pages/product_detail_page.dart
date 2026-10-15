import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../modules/catalog/model/product_detail_entity.dart';
import '../../../../modules/catalog/model/product_query.dart';
import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/price_text.dart';
import '../../../shared/widgets/product_badge.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../view_models/block_state.dart';
import '../view_models/product_detail_view_model.dart';
import '../widgets/category_trail.dart';
import '../widgets/product_description.dart';
import '../widgets/product_gallery.dart';
import '../widgets/product_rail.dart';
import '../widgets/product_specs.dart';
import '../widgets/section_heading.dart';

/// Página do produto, de `product-detail.component.tsx`: a galeria, os
/// selos, a marca, o nome, a unidade e o código, o preço, a trilha de
/// categorias, "Sobre o produto", a ficha e "Mais de `<categoria>`". A única
/// ação principal, "Adicionar ao carrinho", fica fixa no rodapé enquanto o
/// produto está carregado; sem [onAddToCart] aparece desabilitada (o carrinho
/// chega na etapa 9). A navegação sai por callback, como nas outras páginas.
class ProductDetailPage extends WatchingStatefulWidget {
  const ProductDetailPage({
    super.key,
    required this.slug,
    required this.productDetailViewModelFactory,
    required this.onBack,
    required this.onOpenSearch,
    required this.onOpenProduct,
    this.onAddToCart,
  });

  static const String addToCartLabel = 'Adicionar ao carrinho';
  static const String errorTitle = 'Não foi possível carregar o produto.';
  static const String notFoundTitle = 'Produto não encontrado';
  static const String notFoundMessage = 'Ele pode ter saído do catálogo.';
  static const String notFoundAction = 'Voltar ao catálogo';
  static const String featuredLabel = 'Em destaque';

  static String discountLabel(int percent) => '−$percent%';

  static String skuLabel(String sku) => '· Cód. $sku';

  static String relatedTitle(String categoryName) => 'Mais de $categoryName';

  final String slug;

  /// Cria o ViewModel; a rota passa o `registerFactory` da DI.
  final ProductDetailViewModel Function() productDetailViewModelFactory;

  final VoidCallback onBack;

  /// Abre a aba Buscar com a consulta (a marca, uma categoria da trilha ou,
  /// em "Voltar ao catálogo", sem filtros).
  final ValueChanged<ProductQuery> onOpenSearch;

  /// Abre outro produto pelo slug, na pilha da mesma aba.
  final ValueChanged<String> onOpenProduct;

  /// Põe o produto no carrinho; `null` deixa o botão desabilitado.
  final VoidCallback? onAddToCart;

  @override
  State<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends State<ProductDetailPage> {
  late final ProductDetailViewModel _viewModel;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.productDetailViewModelFactory();
    _viewModel.start(widget.slug);
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final product = watchPropertyValue(
      (ProductDetailViewModel vm) => vm.product,
      target: _viewModel,
    );
    final related = watchPropertyValue(
      (ProductDetailViewModel vm) => vm.related,
      target: _viewModel,
    );
    // Derivado de [product], observado acima.
    final isNotFound = _viewModel.isNotFound;

    final Widget body = switch (product) {
      BlockLoading() => const _ProductDetailSkeleton(),
      BlockFailed() when isNotFound => ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: [
          EmptyState(
            emoji: '🔎',
            title: ProductDetailPage.notFoundTitle,
            message: ProductDetailPage.notFoundMessage,
            actionLabel: ProductDetailPage.notFoundAction,
            onAction: () => widget.onOpenSearch(const ProductQuery()),
          ),
        ],
      ),
      BlockFailed(:final failure) => ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: [
          StateErrorBanner(
            title: ProductDetailPage.errorTitle,
            failure: failure,
            onRetry: _viewModel.load.execute,
          ),
        ],
      ),
      BlockLoaded(:final value) => _ProductDetailContent(
        product: value,
        related: related,
        onOpenSearch: widget.onOpenSearch,
        onOpenProduct: widget.onOpenProduct,
      ),
    };

    return Scaffold(
      appBar: AppBar(leading: BackButton(onPressed: widget.onBack)),
      body: body,
      bottomNavigationBar: product is BlockLoaded<ProductDetail>
          ? _AddToCartBar(onAddToCart: widget.onAddToCart)
          : null,
    );
  }
}

class _ProductDetailContent extends StatelessWidget {
  const _ProductDetailContent({
    required this.product,
    required this.related,
    required this.onOpenSearch,
    required this.onOpenProduct,
  });

  final ProductDetail product;
  final List<ProductSummary> related;
  final ValueChanged<ProductQuery> onOpenSearch;
  final ValueChanged<String> onOpenProduct;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;
    final brand = product.brand;
    final sku = product.sku;
    final description = product.description;
    final discount = product.discountPercent;
    final hasDiscount = discount != null && discount > 0;

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.s16),
      children: [
        ProductGallery(key: ValueKey(product.slug), product: product),
        if (product.isFeatured || hasDiscount) ...[
          const SizedBox(height: AppSpacing.s16),
          Wrap(
            spacing: AppSpacing.s8,
            runSpacing: AppSpacing.s8,
            children: [
              if (product.isFeatured)
                const ProductBadge(label: ProductDetailPage.featuredLabel),
              if (hasDiscount)
                ProductBadge(
                  label: ProductDetailPage.discountLabel(discount),
                  variant: ProductBadgeVariant.solid,
                ),
            ],
          ),
        ],
        const SizedBox(height: AppSpacing.s16),
        if (brand != null)
          Align(
            alignment: Alignment.centerLeft,
            child: CatalogLink(
              label: brand.name,
              onTap: () => onOpenSearch(ProductQuery(brandSlugs: [brand.slug])),
            ),
          ),
        Semantics(
          header: true,
          child: Text(
            product.name,
            style: textTheme.productTitle.copyWith(color: tokens.ink),
          ),
        ),
        const SizedBox(height: AppSpacing.s4),
        Text(
          sku == null
              ? product.unit
              : '${product.unit} ${ProductDetailPage.skuLabel(sku)}',
          style: textTheme.bodyMedium!.copyWith(color: tokens.mutedInk),
        ),
        const SizedBox(height: AppSpacing.s16),
        PriceText(
          price: product.price,
          previousPrice: product.listPrice,
          style: textTheme.priceLarge,
        ),
        if (product.categories.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s16),
          CategoryTrail(
            categories: product.categories,
            onOpenCategory: (slug) =>
                onOpenSearch(ProductQuery(categorySlug: slug)),
          ),
        ],
        if (description != null) ...[
          const SizedBox(height: AppSpacing.s24),
          ProductDescription(description: description),
        ],
        const SizedBox(height: AppSpacing.s24),
        ProductSpecs(product: product),
        if (related.isNotEmpty && product.categories.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.s24),
          SectionHeading(
            title: ProductDetailPage.relatedTitle(product.categories.last.name),
          ),
          const SizedBox(height: AppSpacing.s12),
          ProductRail(
            products: related,
            onOpenProduct: onOpenProduct,
            cardWidth: ProductRail.featuredCardWidth,
          ),
        ],
      ],
    );
  }
}

/// Rodapé fixo com a ação principal.
class _AddToCartBar extends StatelessWidget {
  const _AddToCartBar({required this.onAddToCart});

  final VoidCallback? onAddToCart;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        border: Border(top: BorderSide(color: tokens.line)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: AppButton(
            label: ProductDetailPage.addToCartLabel,
            size: AppButtonSize.xl,
            expand: true,
            icon: Icons.shopping_bag_outlined,
            onPressed: onAddToCart,
          ),
        ),
      ),
    );
  }
}

/// Blocos estáticos da galeria, do nome, da unidade e do preço, anunciados
/// uma vez como "Carregando".
class _ProductDetailSkeleton extends StatelessWidget {
  const _ProductDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Carregando',
      excludeSemantics: true,
      child: ListView(
        physics: const NeverScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: const [
          AspectRatio(
            aspectRatio: 1,
            child: SkeletonBox(radius: AppRadius.xl4),
          ),
          SizedBox(height: AppSpacing.s16),
          SkeletonBox(height: 28, radius: AppRadius.sm),
          SizedBox(height: AppSpacing.s8),
          FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: 0.6,
            child: SkeletonBox(height: 28, radius: AppRadius.sm),
          ),
          SizedBox(height: AppSpacing.s12),
          FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: 0.3,
            child: SkeletonBox(height: 16, radius: AppRadius.sm),
          ),
          SizedBox(height: AppSpacing.s16),
          FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: 0.4,
            child: SkeletonBox(height: 36, radius: AppRadius.sm),
          ),
        ],
      ),
    );
  }
}
