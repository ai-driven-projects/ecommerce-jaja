import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart'
    show WatchingStatefulWidget, watchPropertyValue;

import '../../../../modules/order/model/order_entity.dart';
import '../../../../modules/order/model/order_live_status.dart';
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
/// outra falha, o banner com "Tentar de novo".
///
/// O pedido também avança sozinho pelo stream de avisos do ViewModel, só
/// com a tela à vista: a aba escondida pelo `indexedStack` (`TickerMode`
/// desligado) e o app em segundo plano desligam o stream; a volta religa.
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
  late final AppLifecycleListener _lifecycle;
  bool _tabVisible = true;
  bool _appVisible = true;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.orderTrackingViewModelFactory();
    final state = WidgetsBinding.instance.lifecycleState;
    _appVisible = state == null || _isVisible(state);
    // Pelo estado, e não por `onHide`/`onShow`: o binding pode pular os
    // estados intermediários (ex.: do estado desconhecido direto a `paused`).
    _lifecycle = AppLifecycleListener(
      onStateChange: (state) => _setAppVisible(_isVisible(state)),
    );
    _viewModel.start(widget.orderId);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _tabVisible = TickerMode.valuesOf(context).enabled;
    _syncActive();
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    _viewModel.dispose();
    super.dispose();
  }

  static bool _isVisible(AppLifecycleState state) => switch (state) {
    AppLifecycleState.resumed || AppLifecycleState.inactive => true,
    AppLifecycleState.hidden ||
    AppLifecycleState.paused ||
    AppLifecycleState.detached => false,
  };

  void _setAppVisible(bool visible) {
    _appVisible = visible;
    _syncActive();
  }

  void _syncActive() => _viewModel.setActive(_tabVisible && _appVisible);

  @override
  Widget build(BuildContext context) {
    final order = watchPropertyValue(
      (OrderTrackingViewModel vm) => vm.order,
      target: _viewModel,
    );
    final live = watchPropertyValue(
      (OrderTrackingViewModel vm) => vm.live,
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
      BlockLoaded(:final value) => _loaded(value, live),
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

  List<Widget> _loaded(OrderDetail order, OrderLiveStatus live) {
    final instructions = order.deliveryInstructions;
    return [
      OrderHeader(order: order, now: _viewModel.now(), live: live),
      const SizedBox(height: AppSpacing.s20),
      OrderTimeline(order: order, isHighlighted: _viewModel.isHighlighted),
      const SizedBox(height: AppSpacing.s16),
      OrderItemsCard(order: order),
      if (instructions != null && instructions.isNotEmpty) ...[
        const SizedBox(height: AppSpacing.s16),
        OrderInstructionsCard(instructions: instructions),
      ],
    ];
  }
}
