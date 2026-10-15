import 'package:flutter/material.dart';

import '../../../../modules/order/model/placed_order.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/widgets/empty_state.dart';

/// Página provisória do pedido recém-criado, na pilha da aba Carrinho:
/// "Pedido #`<número>` recebido", "Pagamento simulado em andamento." e
/// "Voltar para a loja". O acompanhamento da etapa 13 a troca na mesma rota.
class OrderPlacedPage extends StatelessWidget {
  const OrderPlacedPage({
    super.key,
    required this.orderId,
    required this.onBackToStore,
  });

  static const String message = 'Pagamento simulado em andamento.';
  static const String backToStoreAction = 'Voltar para a loja';

  static String title(String orderId) =>
      'Pedido #${PlacedOrder(orderId).number} recebido';

  final String orderId;

  /// Abre a aba Início.
  final VoidCallback onBackToStore;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: [
          EmptyState(
            emoji: '🚲',
            title: title(orderId),
            message: message,
            actionLabel: backToStoreAction,
            onAction: onBackToStore,
          ),
        ],
      ),
    );
  }
}
