import 'dart:async';

import 'package:flutter/foundation.dart' show ChangeNotifier;

import '../../../../core/command.dart';
import '../../../../core/errors/app_failure.dart';
import '../../../../core/result.dart';
import '../../../../modules/auth/provider/auth_repository.dart';
import '../../../../modules/cart/model/cart_state.dart';
import '../../../../modules/cart/provider/cart_repository.dart';
import '../../../../modules/customer/model/customer_entity.dart';
import '../../../../modules/customer/provider/customer_repository.dart';
import '../../../../modules/order/errors/order_errors.dart';
import '../../../../modules/order/model/placed_order.dart';
import '../../../../modules/order/provider/order_repository.dart';
import '../../../shared/view_models/block_state.dart';

/// Estado da tela "Finalizar pedido", no papel de
/// `apps/frontend/src/modules/orders/pages/checkout.page.tsx`: o carrinho da
/// conta ([cart], acompanhando cada mudança), o cadastro de cliente
/// ([customer]), "Quem recebe" e as instruções (sem validação local: a API
/// decide) e a confirmação ([confirm]).
///
/// [failureMessage] guarda a mensagem da última ação que falhou (para o
/// `SnackBar`) e é limpa quando outra ação começa.
class CheckoutViewModel extends ChangeNotifier {
  CheckoutViewModel(
    this._cart,
    this._customers,
    AuthRepository auth,
    this._orders,
  ) : _cartState = _cart.state,
      _recipientName = auth.currentUser?.name ?? '' {
    confirm = Command0<PlacedOrder>(_confirm, onStateChange: _notify);
    removeLine = Command1<void, String>(_removeLine, onStateChange: _notify);
    _subscription = _cart.changes.listen(_onCartChanged);
  }

  final CartRepository _cart;
  final CustomerRepository _customers;
  final OrderRepository _orders;

  /// Envia `POST /me/orders` com quem recebe e as instruções; com
  /// [canConfirm] falso, nada é enviado.
  late final Command0<PlacedOrder> confirm;

  /// Tira a linha (indisponível) do carrinho.
  late final Command1<void, String> removeLine;

  late final StreamSubscription<CartState> _subscription;
  CartState _cartState;
  BlockState<Customer?> _customer = const BlockLoading();
  int _customerRequest = 0;
  String _recipientName;
  String _instructions = '';
  String? _failureMessage;
  bool _disposed = false;

  CartState get cart => _cartState;

  /// Cadastro de cliente; `BlockLoaded(null)` = sem cadastro.
  BlockState<Customer?> get customer => _customer;

  /// "Quem recebe": começa com o nome da conta da sessão.
  String get recipientName => _recipientName;

  /// "Instruções para o entregador": começa vazio.
  String get instructions => _instructions;

  String? get failureMessage => _failureMessage;

  /// O carrinho mostra linhas: já carregou, sem falha e com itens.
  bool get _cartShown =>
      !_cartState.isRestoring &&
      !_cartState.awaitsFirstPreview &&
      _cartState.previewFailure == null &&
      !_cartState.isEmpty;

  /// Carrinho exibido, sem mudança pendente e sem linha indisponível.
  bool get cartReady =>
      _cartShown &&
      !_cartState.isSyncing &&
      !_cartState.detail.hasUnavailableItems;

  /// O cadastro de cliente carregou e existe.
  bool get deliveryReady => switch (_customer) {
    BlockLoaded(:final value) => value != null,
    BlockLoading() || BlockFailed() => false,
  };

  /// O "Confirmar pedido" está habilitado.
  bool get canConfirm => cartReady && deliveryReady && !confirm.running;

  /// "Remova os itens indisponíveis para confirmar o pedido." abaixo do botão.
  bool get showsUnavailableHint =>
      _cartShown && _cartState.detail.hasUnavailableItems;

  /// "Preencha os dados de entrega para confirmar o pedido." abaixo do botão:
  /// a consulta respondeu sem cadastro.
  bool get showsDeliveryHint => switch (_customer) {
    BlockLoaded(:final value) => value == null,
    BlockLoading() || BlockFailed() => false,
  };

  /// Ao abrir a tela: relê o carrinho da conta e consulta o cadastro, como o
  /// `useEffect` do checkout web.
  void open() {
    _cart.refresh();
    unawaited(loadCustomer());
  }

  /// Consulta o cadastro de cliente (`GET /me/customer`); é também o "Tentar
  /// de novo" do banner e a consulta na volta dos dados de entrega. Só a
  /// resposta da última consulta vale.
  Future<void> loadCustomer() async {
    final request = ++_customerRequest;
    _customer = const BlockLoading();
    _notify();
    final result = await _customers.fetchMine();
    if (request != _customerRequest) return;
    _customer = switch (result) {
      Ok(:final value) => BlockLoaded(value),
      Failure(:final failure) => BlockFailed(failure),
    };
    _notify();
  }

  /// O "Tentar de novo" do banner do resumo: pede o carrinho na hora.
  void retryCart() => _cart.refresh();

  void updateRecipientName(String value) {
    if (_recipientName == value) return;
    _recipientName = value;
    _notify();
  }

  void updateInstructions(String value) {
    if (_instructions == value) return;
    _instructions = value;
    _notify();
  }

  @override
  void dispose() {
    _disposed = true;
    unawaited(_subscription.cancel());
    super.dispose();
  }

  void _onCartChanged(CartState state) {
    _cartState = state;
    _notify();
  }

  Future<Result<PlacedOrder>> _confirm() async {
    _failureMessage = null;
    // `confirm.running` já é verdadeiro aqui: só as outras condições contam.
    if (!cartReady || !deliveryReady) return const Failure(_notReady);

    final result = await _orders.placeOrder(
      recipientName: _recipientName,
      deliveryInstructions: _instructions,
    );
    // O servidor já esvaziou (sucesso) ou conferiu (falha) o carrinho: o app
    // só relê, nunca o esvazia por conta própria.
    _cart.refresh();
    if (result case Failure(:final failure)) {
      _failureMessage = failure.message;
      if (failure case BackendRejectionFailure(
        :final codes,
      ) when isCustomerRejection(codes)) {
        unawaited(loadCustomer());
      }
    }
    return result;
  }

  Future<Result<void>> _removeLine(String productId) async {
    _failureMessage = null;
    final result = await _cart.remove(productId);
    if (result case Failure(:final failure)) {
      _failureMessage = failure.message;
    }
    return result;
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }
}

/// Devolvido por [CheckoutViewModel.confirm] sem enviar nada quando o
/// carrinho ou o cadastro não estão prontos (a tela já desabilita o botão).
const _notReady = ValidationFailure(
  message: 'Não foi possível concluir. Tente novamente.',
  code: GenericFailureCode.unspecified,
);
