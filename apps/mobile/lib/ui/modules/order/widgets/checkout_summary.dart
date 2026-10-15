import 'package:flutter/material.dart';

import '../../../../modules/cart/model/cart_entity.dart';
import '../../../../modules/cart/model/cart_state.dart';
import '../../../shared/theme/app_radius.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/skeleton_box.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../../cart/widgets/cart_summary.dart';
import 'checkout_line_tile.dart';
import 'checkout_step_card.dart';

/// Cartão "Resumo do pedido": o skeleton antes da primeira resposta do
/// carrinho, o banner com "Tentar de novo" na falha, o vazio com "Voltar para
/// a loja" ou as linhas com os totais da API ([CartSummary.checkout]).
class CheckoutSummary extends StatelessWidget {
  const CheckoutSummary({
    super.key,
    required this.cart,
    required this.onRetry,
    required this.onRemove,
    required this.onOpenStore,
  });

  static const String title = 'Resumo do pedido';
  static const String errorTitle = 'Não foi possível carregar o carrinho.';
  static const String emptyTitle = 'Seu carrinho está vazio.';
  static const String emptyMessage = 'Adicione itens para o escritório!';
  static const String emptyAction = 'Voltar para a loja';
  static const int skeletonCount = 2;

  final CartState cart;

  /// O "Tentar de novo" do banner.
  final VoidCallback onRetry;

  /// Tira a linha do carrinho pelo id do produto.
  final ValueChanged<String> onRemove;

  /// Abre a aba Início.
  final VoidCallback onOpenStore;

  @override
  Widget build(BuildContext context) {
    return CheckoutStepCard(title: title, children: _content(context));
  }

  List<Widget> _content(BuildContext context) {
    if (cart.isRestoring || cart.awaitsFirstPreview) {
      return const [_SummaryLinesSkeleton()];
    }
    // A carga da conta pode falhar sem itens: a falha vem antes do vazio.
    if (cart.previewFailure case final failure?) {
      return [
        StateErrorBanner(title: errorTitle, failure: failure, onRetry: onRetry),
      ];
    }
    if (cart.isEmpty) {
      return [
        EmptyState(
          emoji: '🛒',
          title: emptyTitle,
          message: emptyMessage,
          actionLabel: emptyAction,
          onAction: onOpenStore,
        ),
      ];
    }
    return [
      for (final CartLine line in cart.lines) ...[
        CheckoutLineTile(
          key: ValueKey(line.productId),
          line: line,
          onRemove: () => onRemove(line.productId),
        ),
        const SizedBox(height: AppSpacing.s12),
      ],
      Divider(height: AppSpacing.s12, color: context.tokens.line),
      const SizedBox(height: AppSpacing.s8),
      CartSummary.checkout(detail: cart.detail, isSyncing: cart.isSyncing),
    ];
  }
}

/// Linhas estáticas no lugar das do resumo, anunciadas uma vez como
/// "Carregando".
class _SummaryLinesSkeleton extends StatelessWidget {
  const _SummaryLinesSkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: 'Carregando',
      excludeSemantics: true,
      child: Column(
        children: [
          for (var index = 0; index < CheckoutSummary.skeletonCount; index++)
            const Padding(
              padding: EdgeInsets.only(bottom: AppSpacing.s12),
              child: Row(
                children: [
                  SkeletonBox(
                    width: CheckoutLineTile.artSize,
                    height: CheckoutLineTile.artSize,
                    radius: AppRadius.lg,
                  ),
                  SizedBox(width: AppSpacing.s12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBox(height: 14, radius: AppRadius.sm),
                        SizedBox(height: AppSpacing.s8),
                        FractionallySizedBox(
                          widthFactor: 0.3,
                          child: SkeletonBox(height: 12, radius: AppRadius.sm),
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
