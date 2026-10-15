import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../core/value_objects/money.dart';
import '../../../../modules/cart/model/cart_entity.dart';
import '../../../../modules/cart/model/cart_state.dart';
import '../../../shared/formatters/money_formatter.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../view_models/cart_view_model.dart';
import '../widgets/cart_line_tile.dart';
import '../widgets/cart_summary.dart';

/// Aba Carrinho: "Seu carrinho" e, conforme o estado, o skeleton das linhas
/// (abertura do app, primeira prévia ou carga da conta), o banner do carrinho
/// que não carregou, o vazio com "Ver produtos" ou as linhas com o resumo e
/// "Finalizar pedido", que abre o checkout (desabilitado com mudança não
/// confirmada ou linha indisponível). Fora do skeleton, a mescla que falhou
/// aparece no topo. A navegação sai por callback.
class CartPage extends WatchingStatefulWidget {
  const CartPage({
    super.key,
    required this.cartViewModelFactory,
    required this.onOpenProduct,
    required this.onOpenSearch,
    required this.onOpenCheckout,
  });

  static const String title = 'Seu carrinho';
  static const String emptyTitle = 'Seu carrinho está vazio.';
  static const String emptyMessage = 'Adicione itens para o escritório!';
  static const String emptyAction = 'Ver produtos';
  static const String errorTitle = 'Não foi possível carregar o carrinho.';
  static const String mergeErrorTitle =
      'Não foi possível juntar o carrinho deste aparelho à sua conta.';
  static const int skeletonCount = 3;

  static String checkoutLabel(Money total) =>
      'Finalizar pedido · ${formatMoney(total)}';

  /// Cria o ViewModel do carrinho; a rota passa o `registerFactory` da DI.
  final CartViewModel Function() cartViewModelFactory;

  /// Abre o produto pelo slug, na pilha da aba.
  final ValueChanged<String> onOpenProduct;

  /// Abre a aba Buscar sem filtros.
  final VoidCallback onOpenSearch;

  /// Abre o checkout na pilha da aba (a guarda leva a "Entrar" sem sessão).
  final VoidCallback onOpenCheckout;

  @override
  State<CartPage> createState() => _CartPageState();
}

class _CartPageState extends State<CartPage> {
  late final CartViewModel _viewModel;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.cartViewModelFactory();
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  Future<void> _changeQuantity(String productId, int quantity) async {
    final messenger = ScaffoldMessenger.of(context);
    await _viewModel.changeQuantity.execute((
      productId: productId,
      quantity: quantity,
    ));
    _showFailure(messenger);
  }

  Future<void> _remove(String productId) async {
    final messenger = ScaffoldMessenger.of(context);
    await _viewModel.remove.execute(productId);
    _showFailure(messenger);
  }

  void _showFailure(ScaffoldMessengerState messenger) {
    final message = _viewModel.failureMessage;
    if (message != null) {
      messenger.showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = watchPropertyValue(
      (CartViewModel vm) => vm.state,
      target: _viewModel,
    );
    final textTheme = Theme.of(context).textTheme;
    final showsLines =
        !state.isRestoring &&
        !state.awaitsFirstPreview &&
        !state.isEmpty &&
        state.previewFailure == null;

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(AppSpacing.s16),
          children: [
            Text(
              CartPage.title,
              style: textTheme.headlineSmall!.copyWith(
                color: context.tokens.ink,
              ),
            ),
            const SizedBox(height: AppSpacing.s16),
            if (state.mergeFailure case final failure?
                when !state.isRestoring && !state.awaitsFirstPreview) ...[
              StateErrorBanner(
                title: CartPage.mergeErrorTitle,
                failure: failure,
                onRetry: _viewModel.retry,
              ),
              const SizedBox(height: AppSpacing.s16),
            ],
            ..._content(state),
          ],
        ),
      ),
      bottomNavigationBar: showsLines
          ? _CheckoutBar(
              label: CartPage.checkoutLabel(state.detail.total),
              onPressed: state.isSyncing || state.detail.hasUnavailableItems
                  ? null
                  : widget.onOpenCheckout,
            )
          : null,
    );
  }

  List<Widget> _content(CartState state) {
    if (state.isRestoring || state.awaitsFirstPreview) {
      return const [_CartLinesSkeleton()];
    }
    // A carga da conta pode falhar sem itens: a falha vem antes do vazio.
    if (state.previewFailure case final failure?) {
      return [
        StateErrorBanner(
          title: CartPage.errorTitle,
          failure: failure,
          onRetry: _viewModel.retry,
        ),
      ];
    }
    if (state.isEmpty) {
      return [
        EmptyState(
          emoji: '🛒',
          title: CartPage.emptyTitle,
          message: CartPage.emptyMessage,
          actionLabel: CartPage.emptyAction,
          onAction: widget.onOpenSearch,
        ),
      ];
    }
    return [
      for (final CartLine line in state.lines) ...[
        CartLineTile(
          key: ValueKey(line.productId),
          line: line,
          onOpenProduct: widget.onOpenProduct,
          onChangeQuantity: (quantity) =>
              _changeQuantity(line.productId, quantity),
          onRemove: () => _remove(line.productId),
        ),
        const Divider(height: AppSpacing.s24),
      ],
      CartSummary(detail: state.detail, isSyncing: state.isSyncing),
    ];
  }
}

/// Rodapé com a ação principal, no molde do "Adicionar" do produto.
class _CheckoutBar extends StatelessWidget {
  const _CheckoutBar({required this.label, required this.onPressed});

  final String label;

  /// `null` deixa a ação desabilitada.
  final VoidCallback? onPressed;

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
            label: label,
            size: AppButtonSize.xl,
            expand: true,
            onPressed: onPressed,
          ),
        ),
      ),
    );
  }
}

/// Linhas estáticas no lugar das do carrinho, anunciadas uma vez como
/// "Carregando".
class _CartLinesSkeleton extends StatelessWidget {
  const _CartLinesSkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Carregando',
      excludeSemantics: true,
      child: Column(
        children: [
          for (var index = 0; index < CartPage.skeletonCount; index++)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.s16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBox(
                    width: CartLineTile.artSize,
                    height: CartLineTile.artSize,
                    radius: AppRadius.lg,
                  ),
                  SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBox(height: 16, radius: AppRadius.sm),
                        SizedBox(height: AppSpacing.s8),
                        FractionallySizedBox(
                          widthFactor: 0.5,
                          child: SkeletonBox(height: 12, radius: AppRadius.sm),
                        ),
                        SizedBox(height: AppSpacing.s12),
                        SkeletonBox(
                          width: 96,
                          height: 32,
                          radius: AppRadius.pill,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
