import 'package:flutter/material.dart';
import 'package:watch_it/watch_it.dart' show WatchingStatefulWidget, watch;

import '../../../../core/result.dart';
import '../../../../core/value_objects/money.dart';
import '../../../../modules/order/model/placed_order.dart';
import '../../../shared/formatters/money_formatter.dart';
import '../../../shared/theme/app_spacing.dart';
import '../../../shared/theme/brand_tokens.dart';
import '../../../shared/widgets/app_button.dart';
import '../../customer/view_models/customer_texts.dart';
import '../view_models/checkout_view_model.dart';
import '../widgets/checkout_step_card.dart';
import '../widgets/checkout_summary.dart';
import '../widgets/delivery_step.dart';
import '../widgets/order_note_fields.dart';
import '../widgets/payment_step.dart';

/// Tela "Finalizar pedido", na pilha da aba Carrinho (`checkout.page.tsx` do
/// web, com sessão garantida pela rota): "1 Endereço de entrega" (o cadastro
/// de cliente, quem recebe e as instruções), "2 Pagamento" simulado e o
/// "Resumo do pedido", com "Confirmar pedido · `<total>`" fixo no rodapé. Ao
/// abrir, relê o carrinho da conta e consulta o cadastro. A navegação sai por
/// callback.
class CheckoutPage extends WatchingStatefulWidget {
  const CheckoutPage({
    super.key,
    required this.checkoutViewModelFactory,
    required this.onOpenDeliveryDetails,
    required this.onOpenStore,
    required this.onOrderPlaced,
  });

  static const String title = 'Finalizar pedido';
  static const String deliveryTitle = CustomerTexts.addressTitle;
  static const String confirmingLabel = 'Confirmando…';
  static const String unavailableHint =
      'Remova os itens indisponíveis para confirmar o pedido.';
  static const String deliveryHint =
      'Preencha os dados de entrega para confirmar o pedido.';
  static const String termsNote =
      'Ao confirmar, você concorda com os termos do já já.';
  static const String paymentPendingMessage =
      'Pagamento simulado em andamento.';

  static String confirmLabel(Money total) =>
      'Confirmar pedido · ${formatMoney(total)}';

  static String placedMessage(PlacedOrder order) =>
      'Pedido #${order.number} recebido';

  /// Cria o ViewModel; a rota passa o `registerFactory` da DI.
  final CheckoutViewModel Function() checkoutViewModelFactory;

  /// Abre a tela "Dados de entrega" na pilha do checkout; o `Future` completa
  /// na volta, e a tela consulta o cadastro de novo.
  final Future<void> Function() onOpenDeliveryDetails;

  /// Abre a aba Início.
  final VoidCallback onOpenStore;

  /// Leva ao pedido criado, pelo id.
  final ValueChanged<String> onOrderPlaced;

  @override
  State<CheckoutPage> createState() => _CheckoutPageState();
}

class _CheckoutPageState extends State<CheckoutPage> {
  late final CheckoutViewModel _viewModel;
  late final TextEditingController _recipientController;
  late final TextEditingController _instructionsController;

  @override
  void initState() {
    super.initState();
    _viewModel = widget.checkoutViewModelFactory();
    _recipientController = TextEditingController(
      text: _viewModel.recipientName,
    );
    _instructionsController = TextEditingController(
      text: _viewModel.instructions,
    );
    _viewModel.open();
  }

  @override
  void dispose() {
    _viewModel.dispose();
    _recipientController.dispose();
    _instructionsController.dispose();
    super.dispose();
  }

  Future<void> _openDeliveryDetails() async {
    await widget.onOpenDeliveryDetails();
    if (!mounted) return;
    await _viewModel.loadCustomer();
  }

  Future<void> _confirm() async {
    // O `ScaffoldMessenger` é do app: o aviso continua depois de navegar.
    final messenger = ScaffoldMessenger.of(context);
    await _viewModel.confirm.execute();
    switch (_viewModel.confirm.result) {
      case Ok(:final value):
        messenger.showSnackBar(SnackBar(content: _PlacedMessage(order: value)));
        widget.onOrderPlaced(value.id);
      case Failure():
        _showFailure(messenger);
      case null:
        break;
    }
  }

  Future<void> _remove(String productId) async {
    final messenger = ScaffoldMessenger.of(context);
    await _viewModel.removeLine.execute(productId);
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
    watch(_viewModel);

    return Scaffold(
      appBar: AppBar(title: const Text(CheckoutPage.title)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.s16),
        children: [
          CheckoutStepCard(
            number: 1,
            title: CheckoutPage.deliveryTitle,
            children: [
              DeliveryStep(
                customer: _viewModel.customer,
                onRetry: _viewModel.loadCustomer,
                onOpenDeliveryDetails: _openDeliveryDetails,
              ),
              const SizedBox(height: AppSpacing.s16),
              OrderNoteFields(
                recipientController: _recipientController,
                instructionsController: _instructionsController,
                onRecipientChanged: _viewModel.updateRecipientName,
                onInstructionsChanged: _viewModel.updateInstructions,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.s16),
          const PaymentStep(),
          const SizedBox(height: AppSpacing.s16),
          CheckoutSummary(
            cart: _viewModel.cart,
            onRetry: _viewModel.retryCart,
            onRemove: _remove,
            onOpenStore: widget.onOpenStore,
          ),
        ],
      ),
      bottomNavigationBar: _ConfirmBar(
        label: _viewModel.confirm.running
            ? CheckoutPage.confirmingLabel
            : CheckoutPage.confirmLabel(_viewModel.cart.detail.total),
        onPressed: _viewModel.canConfirm ? _confirm : null,
        showsUnavailableHint: _viewModel.showsUnavailableHint,
        showsDeliveryHint: _viewModel.showsDeliveryHint,
      ),
    );
  }
}

/// "Pedido #`<número>` recebido" com "Pagamento simulado em andamento.".
class _PlacedMessage extends StatelessWidget {
  const _PlacedMessage({required this.order});

  final PlacedOrder order;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(CheckoutPage.placedMessage(order)),
        const Text(CheckoutPage.paymentPendingMessage),
      ],
    );
  }
}

/// Rodapé fixo, no molde do "Finalizar pedido" da aba Carrinho: o botão, os
/// avisos de quando ele fica indisponível e a nota dos termos.
class _ConfirmBar extends StatelessWidget {
  const _ConfirmBar({
    required this.label,
    required this.onPressed,
    required this.showsUnavailableHint,
    required this.showsDeliveryHint,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool showsUnavailableHint;
  final bool showsDeliveryHint;

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
            children: [
              AppButton(
                label: label,
                size: AppButtonSize.xl,
                expand: true,
                onPressed: onPressed,
              ),
              if (showsUnavailableHint) ...[
                const SizedBox(height: AppSpacing.s10),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    CheckoutPage.unavailableHint,
                    textAlign: TextAlign.center,
                    style: textTheme.labelMedium!.copyWith(
                      color: tokens.danger,
                    ),
                  ),
                ),
              ],
              if (showsDeliveryHint) ...[
                const SizedBox(height: AppSpacing.s10),
                Text(
                  CheckoutPage.deliveryHint,
                  textAlign: TextAlign.center,
                  style: textTheme.labelMedium!.copyWith(color: tokens.inkSoft),
                ),
              ],
              const SizedBox(height: AppSpacing.s10),
              Text(
                CheckoutPage.termsNote,
                textAlign: TextAlign.center,
                style: textTheme.bodySmall!.copyWith(color: tokens.placeholder),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
