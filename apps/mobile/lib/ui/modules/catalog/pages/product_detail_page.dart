import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../core/result.dart';
import '../../../../core/value_objects/money.dart';
import '../../../../modules/cart/model/cart_rules.dart';
import '../../../../modules/catalog/model/product_detail_entity.dart';
import '../../../../modules/catalog/model/product_query.dart';
import '../../../../modules/catalog/model/product_summary_entity.dart';
import '../../../shared/formatters/money_formatter.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/app_typography.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/price_text.dart';
import '../../../shared/widgets/product_badge.dart';
import '../../../shared/widgets/quantity_stepper.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../../../shared/view_models/block_state.dart';
import '../view_models/product_detail_view_model.dart';
import '../widgets/category_trail.dart';
import '../widgets/product_description.dart';
import '../widgets/product_gallery.dart';
import '../widgets/product_rail.dart';
import '../widgets/product_specs.dart';
import '../widgets/section_heading.dart';

/// Página do produto, de `product-detail.component.tsx`: a galeria, os
/// selos, a marca, o nome, a unidade e o código, o preço, o cartão de entrega,
/// a trilha de categorias, "Sobre o produto", a ficha e "Mais de
/// `<categoria>`". A única ação principal fica fixa no rodapé enquanto o
/// produto está carregado: a quantidade e "Adicionar · `<total>`", com o aviso
/// "Adicionado ao carrinho" e "Ver carrinho" no sucesso. A navegação sai por
/// callback, como nas outras páginas.
class ProductDetailPage extends WatchingStatefulWidget {
  const ProductDetailPage({
    super.key,
    required this.slug,
    required this.productDetailViewModelFactory,
    required this.onBack,
    required this.onOpenSearch,
    required this.onOpenProduct,
    required this.onOpenCart,
  });

  static const String addingLabel = 'Adicionando…';
  static const String addedTitle = 'Adicionado ao carrinho';
  static const String openCartAction = 'Ver carrinho';
  static const String errorTitle = 'Não foi possível carregar o produto.';
  static const String notFoundTitle = 'Produto não encontrado';
  static const String notFoundMessage = 'Ele pode ter saído do catálogo.';
  static const String notFoundAction = 'Voltar ao catálogo';
  static const String featuredLabel = 'Em destaque';

  static String addLabel(Money total) => 'Adicionar · ${formatMoney(total)}';

  static String addedDetail(int quantity, Money total) =>
      '$quantity un · ${formatMoney(total)}';

  static String inCartLabel(int quantity) =>
      'Você já tem $quantity no carrinho.';

  static String freeDeliveryLabel(Money threshold) =>
      'Entrega grátis acima de ${formatMoney(threshold)}';

  static String deliveryFeeLabel(Money fee) =>
      'Abaixo disso, taxa fixa de ${formatMoney(fee)}';

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

  /// Abre a aba Carrinho, pelo "Ver carrinho" do aviso.
  final VoidCallback onOpenCart;

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

  /// Inclui a quantidade escolhida e avisa o resultado. O
  /// [ScaffoldMessenger] é capturado antes do `await`.
  Future<void> _addToCart() async {
    final messenger = ScaffoldMessenger.of(context);
    final textTheme = Theme.of(context).textTheme;
    final onSnackBar = Theme.of(context).colorScheme.onInverseSurface;
    await _viewModel.addToCart.execute();
    switch (_viewModel.addToCart.result) {
      case Ok(:final value):
        messenger
          ..hideCurrentSnackBar()
          ..showSnackBar(
            SnackBar(
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ProductDetailPage.addedTitle,
                    style: textTheme.titleSmall!.copyWith(color: onSnackBar),
                  ),
                  Text(
                    ProductDetailPage.addedDetail(value.quantity, value.total),
                    style: textTheme.bodyMedium!.copyWith(color: onSnackBar),
                  ),
                ],
              ),
              // Some sozinho, como o toaster do web: o aviso fica no
              // `ScaffoldMessenger` do app e não deve seguir para outra aba.
              persist: false,
              action: SnackBarAction(
                label: ProductDetailPage.openCartAction,
                onPressed: widget.onOpenCart,
              ),
            ),
          );
      case Failure(:final failure):
        messenger
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(content: Text(failure.message)));
      case null:
        break;
    }
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
    final quantity = watchPropertyValue(
      (ProductDetailViewModel vm) => vm.quantity,
      target: _viewModel,
    );
    final inCart = watchPropertyValue(
      (ProductDetailViewModel vm) => vm.inCart,
      target: _viewModel,
    );
    final isAdding = watchPropertyValue(
      (ProductDetailViewModel vm) => vm.addToCart.running,
      target: _viewModel,
    );
    // Derivados de [product] e [quantity], observados acima.
    final isNotFound = _viewModel.isNotFound;
    final total = _viewModel.total;

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
      bottomNavigationBar: switch (product) {
        BlockLoaded(:final value) when total != null => _AddToCartBar(
          itemName: value.name,
          quantity: quantity,
          total: total,
          inCart: inCart,
          isAdding: isAdding,
          onDecrement: _viewModel.canDecrement ? _viewModel.decrement : null,
          onIncrement: _viewModel.canIncrement ? _viewModel.increment : null,
          onAdd: _addToCart,
        ),
        _ => null,
      },
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
        const SizedBox(height: AppSpacing.s16),
        const _DeliveryCard(),
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

/// Regra de frete da loja, com os valores de `cart_rules.dart`.
class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        borderRadius: BorderRadius.circular(AppRadius.xl2),
        border: Border.all(color: tokens.line),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.s16),
        child: Row(
          children: [
            Icon(Icons.local_shipping_outlined, color: tokens.brand),
            const SizedBox(width: AppSpacing.s12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    ProductDetailPage.freeDeliveryLabel(freeDeliveryThreshold),
                    style: textTheme.titleSmall!.copyWith(color: tokens.ink),
                  ),
                  const SizedBox(height: AppSpacing.s4),
                  Text(
                    ProductDetailPage.deliveryFeeLabel(deliveryFee),
                    style: textTheme.bodySmall!.copyWith(
                      color: tokens.mutedInk,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Rodapé fixo com a ação principal: "Você já tem N no carrinho.", a
/// quantidade e "Adicionar · `<total>`" ("Adicionando…" e indisponível
/// enquanto a inclusão roda).
class _AddToCartBar extends StatelessWidget {
  const _AddToCartBar({
    required this.itemName,
    required this.quantity,
    required this.total,
    required this.inCart,
    required this.isAdding,
    required this.onDecrement,
    required this.onIncrement,
    required this.onAdd,
  });

  final String itemName;
  final int quantity;
  final Money total;
  final int inCart;
  final bool isAdding;
  final VoidCallback? onDecrement;
  final VoidCallback? onIncrement;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final textTheme = Theme.of(context).textTheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: tokens.card,
        border: Border(top: BorderSide(color: tokens.line)),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.s16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (inCart > 0) ...[
                Semantics(
                  liveRegion: true,
                  child: Text(
                    ProductDetailPage.inCartLabel(inCart),
                    style: textTheme.labelMedium!.copyWith(
                      color: tokens.inkSoft,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.s8),
              ],
              Row(
                children: [
                  QuantityStepper(
                    quantity: quantity,
                    itemName: itemName,
                    onDecrement: isAdding ? null : onDecrement,
                    onIncrement: isAdding ? null : onIncrement,
                    size: QuantityStepperSize.large,
                  ),
                  const SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: AppButton(
                      label: isAdding
                          ? ProductDetailPage.addingLabel
                          : ProductDetailPage.addLabel(total),
                      size: AppButtonSize.xl,
                      expand: true,
                      icon: Icons.shopping_bag_outlined,
                      onPressed: isAdding ? null : onAdd,
                    ),
                  ),
                ],
              ),
            ],
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
