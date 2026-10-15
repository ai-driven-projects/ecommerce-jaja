import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../modules/order/model/order_entity.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/view_models/block_state.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/state_error_banner.dart';
import '../view_models/order_tracking_view_model.dart';
import '../widgets/order_header.dart';
import '../widgets/order_instructions_card.dart';
import '../widgets/order_items_card.dart';
import '../widgets/order_timeline.dart';
import '../widgets/order_tracking_skeleton.dart';

/// Acompanhamento do pedido, de `order-tracking.component.tsx`, na pilha da
/// aba Carrinho: o skeleton na carga, o cabeçalho, a linha do tempo, os
/// itens com os totais e as instruções (quando existem). Puxar a tela relê o
/// pedido. O `404` mostra "Pedido não encontrado." com "Voltar para a loja";
/// outra falha, o banner com "Tentar de novo". Sem atualização ao vivo.
class OrderTrackingPage extends WatchingStatefulWidget {
  const OrderTrackingPage({
    super.key,
    required this.orderTrackingViewModelFactory,
    required this.orderId,
    required this.onBackToStore,
  });

  static const String notFoundTitle = 'Pedido não encontrado.';
  static const String notFoundMessage = 'Ele não existe ou é de outra conta.';
  static const String backToStoreAction = 'Voltar para a loja';
  static const String errorTitle = 'Não foi possível carregar o pedido.';

  /// Cria o ViewModel; a rota passa o `registerFactory` da DI.
  final OrderTrackingViewModel Function() orderTrackingViewModelFactory;

  final String orderId;

  /// Abre a aba Início.
  final VoidCallback onBackToStore;

  @override
  State<OrderTrackingPage> createState() => _OrderTrackingPageState();
}

class _OrderTrackingPageState extends State<OrderTrackingPage> {
  late final OrderTrackingViewModel _viewModel;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.orderTrackingViewModelFactory();
    _viewModel.start(widget.orderId);
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final order = watchPropertyValue(
      (OrderTrackingViewModel vm) => vm.order,
      target: _viewModel,
    );
    // Derivado de [order], observado acima.
    final isNotFound = _viewModel.isNotFound;

    final List<Widget> content = switch (order) {
      BlockLoading() => const [OrderTrackingSkeleton()],
      BlockFailed() when isNotFound => [
        EmptyState(
          emoji: '🔎',
          title: OrderTrackingPage.notFoundTitle,
          message: OrderTrackingPage.notFoundMessage,
          actionLabel: OrderTrackingPage.backToStoreAction,
          onAction: widget.onBackToStore,
        ),
      ],
      BlockFailed(:final failure) => [
        StateErrorBanner(
          title: OrderTrackingPage.errorTitle,
          failure: failure,
          onRetry: _viewModel.load,
        ),
      ],
      BlockLoaded(:final value) => _loaded(value),
    };

    return Scaffold(
      appBar: AppBar(),
      body: RefreshIndicator(
        onRefresh: _viewModel.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.s16),
          children: content,
        ),
      ),
    );
  }

  List<Widget> _loaded(OrderDetail order) {
    final instructions = order.deliveryInstructions;
    return [
      OrderHeader(order: order, now: _viewModel.now()),
      const SizedBox(height: AppSpacing.s20),
      OrderTimeline(order: order),
      const SizedBox(height: AppSpacing.s16),
      OrderItemsCard(order: order),
      if (instructions != null && instructions.isNotEmpty) ...[
        const SizedBox(height: AppSpacing.s16),
        OrderInstructionsCard(instructions: instructions),
      ],
    ];
  }
}
