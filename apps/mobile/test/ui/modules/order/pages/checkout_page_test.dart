import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';
import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/modules/order/errors/order_errors.dart';
import 'package:mobile/modules/order/model/placed_order.dart';
import 'package:mobile/ui/modules/cart/widgets/cart_summary.dart';
import 'package:mobile/ui/modules/order/pages/checkout_page.dart';
import 'package:mobile/ui/modules/order/view_models/checkout_view_model.dart';
import 'package:mobile/ui/modules/order/widgets/checkout_line_tile.dart';
import 'package:mobile/ui/modules/order/widgets/checkout_summary.dart';
import 'package:mobile/ui/modules/order/widgets/delivery_step.dart';
import 'package:mobile/ui/modules/order/widgets/order_note_fields.dart';
import 'package:mobile/ui/modules/order/widgets/payment_step.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';
import 'package:mobile/ui/shared/widgets/app_text_field.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';

import '../../../../modules/auth/support/auth_fixtures.dart';
import '../../../../modules/auth/support/fake_auth_repository.dart';
import '../../../../modules/cart/support/cart_fixtures.dart';
import '../../../../modules/cart/support/fake_cart_repository.dart';
import '../../../../modules/customer/support/customer_fixtures.dart';
import '../../../../modules/customer/support/fake_customer_repository.dart';
import '../../../../modules/order/support/fake_order_repository.dart';

const _noConnection = NetworkFailure(
  message: 'Sem conexão com a internet.',
  code: HttpFailureCode.noConnection,
);

const _productUnavailable = NotFoundFailure(
  message: 'Produto indisponível.',
  code: CartErrorCode.productUnavailable,
);

final _customerInactive = BackendRejectionFailure(
  message: OrderErrorCode.customerInactive.message,
  code: OrderErrorCode.customerInactive,
  statusCode: 400,
  codes: [OrderErrorCode.customerInactive.backendCode],
);

// Os três cartões e o rodapé à vista sem rolar.
const _surface = Size(800, 2400);

const _address =
    'Avenida Santos Dumont, 1500 · Sala 3 · Aldeota · Fortaleza/CE · '
    '60150-160';

/// Navegação pedida pela página. Cada abertura dos dados de entrega fica
/// pendente até o teste chamar [returnFromDelivery].
class _Navigation {
  final List<Completer<void>> deliveryOpens = [];
  final List<String> placed = [];
  int stores = 0;

  Future<void> openDelivery() {
    final completer = Completer<void>();
    deliveryOpens.add(completer);
    return completer.future;
  }

  void returnFromDelivery() => deliveryOpens.last.complete();
}

class _Fakes {
  _Fakes({CartState? cart, Customer? customer = fortalezaCustomer})
    : cart = FakeCartRepository(state: cart ?? stateOf([canetaLine])),
      customers = FakeCustomerRepository(mine: customer);

  final FakeCartRepository cart;
  final FakeCustomerRepository customers;
  final FakeAuthRepository auth = FakeAuthRepository(currentUser: ana);
  final FakeOrderRepository orders = FakeOrderRepository();
}

Future<_Navigation> _pumpPage(WidgetTester tester, _Fakes fakes) async {
  tester.view.physicalSize = _surface;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(fakes.cart.dispose);
  addTearDown(fakes.auth.dispose);

  final navigation = _Navigation();
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: CheckoutPage(
        checkoutViewModelFactory: () => CheckoutViewModel(
          fakes.cart,
          fakes.customers,
          fakes.auth,
          fakes.orders,
        ),
        onOpenDeliveryDetails: navigation.openDelivery,
        onOpenStore: () => navigation.stores++,
        onOrderPlaced: navigation.placed.add,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return navigation;
}

Finder _inDelivery(Finder finder) =>
    find.descendant(of: find.byType(DeliveryStep), matching: finder);

Finder _inSummary(Finder finder) =>
    find.descendant(of: find.byType(CheckoutSummary), matching: finder);

Finder _field(String label) => find.descendant(
  of: find.widgetWithText(AppTextField, label),
  matching: find.byType(TextField),
);

Finder get _confirmButton =>
    find.widgetWithText(AppButton, 'Confirmar pedido · R\$ 30,70');

bool _enabled(WidgetTester tester, Finder button) =>
    tester.widget<AppButton>(button).onPressed != null;

void main() {
  group('dados de entrega', () {
    testWidgets('consultando o cadastro mostra o skeleton do passo', (
      tester,
    ) async {
      final fakes = _Fakes();
      final pending = fakes.customers.holdFetch();
      await _pumpPage(tester, fakes);

      expect(find.text(CheckoutPage.deliveryTitle), findsOneWidget);
      expect(_inDelivery(find.byType(SkeletonBox)), findsOneWidget);
      expect(find.text(DeliveryStep.editAction), findsNothing);
      expect(find.text(DeliveryStep.fillAction), findsNothing);
      expect(find.text(CheckoutPage.deliveryHint), findsNothing);

      pending.complete(const Ok(fortalezaCustomer));
      await tester.pumpAndSettle();

      expect(_inDelivery(find.byType(SkeletonBox)), findsNothing);
      expect(find.text(_address), findsOneWidget);
    });

    testWidgets('falha mostra o banner e "Tentar de novo" consulta de novo', (
      tester,
    ) async {
      final fakes = _Fakes();
      fakes.customers.enqueueFetch(const Failure(_noConnection));
      await _pumpPage(tester, fakes);

      expect(find.text(DeliveryStep.errorTitle), findsOneWidget);
      expect(find.text(_noConnection.message), findsOneWidget);
      expect(find.text(CheckoutPage.deliveryHint), findsNothing);
      expect(_enabled(tester, _confirmButton), isFalse);

      await tester.tap(_inDelivery(find.text('Tentar de novo')));
      await tester.pumpAndSettle();

      expect(fakes.customers.fetchCalls, 2);
      expect(find.text(DeliveryStep.errorTitle), findsNothing);
      expect(find.text(_address), findsOneWidget);
    });

    testWidgets('sem cadastro mostra o convite; voltar da ação consulta de '
        'novo', (tester) async {
      final fakes = _Fakes(customer: null);
      final navigation = await _pumpPage(tester, fakes);

      expect(find.text(DeliveryStep.newCustomerMessage), findsOneWidget);
      expect(find.text(DeliveryStep.editAction), findsNothing);

      await tester.tap(find.text(DeliveryStep.fillAction));
      await tester.pumpAndSettle();

      expect(navigation.deliveryOpens, hasLength(1));
      expect(fakes.customers.fetchCalls, 1);

      fakes.customers.mine = fortalezaCustomer;
      navigation.returnFromDelivery();
      await tester.pumpAndSettle();

      expect(fakes.customers.fetchCalls, 2);
      expect(find.text(DeliveryStep.newCustomerMessage), findsNothing);
      expect(find.text(_address), findsOneWidget);
    });

    testWidgets('com cadastro mostra o endereço, o telefone mascarado e '
        '"Alterar", que consulta de novo na volta', (tester) async {
      final fakes = _Fakes();
      final navigation = await _pumpPage(tester, fakes);

      expect(find.text(_address), findsOneWidget);
      expect(find.text('(85) 99999-8888'), findsOneWidget);
      expect(find.text(DeliveryStep.newCustomerMessage), findsNothing);

      await tester.tap(find.text(DeliveryStep.editAction));
      await tester.pumpAndSettle();

      expect(navigation.deliveryOpens, hasLength(1));
      expect(fakes.customers.fetchCalls, 1);

      navigation.returnFromDelivery();
      await tester.pumpAndSettle();

      expect(fakes.customers.fetchCalls, 2);
    });

    testWidgets('"Quem recebe" vem com o nome da conta e as instruções, '
        'vazias', (tester) async {
      await _pumpPage(tester, _Fakes());

      expect(
        tester
            .widget<TextField>(_field(OrderNoteFields.recipientLabel))
            .controller!
            .text,
        'Ana Souza',
      );
      expect(
        tester
            .widget<TextField>(_field(OrderNoteFields.instructionsLabel))
            .controller!
            .text,
        isEmpty,
      );
      expect(find.text(OrderNoteFields.instructionsHint), findsOneWidget);
    });
  });

  group('pagamento e resumo', () {
    testWidgets('pagamento mostra "Simulado" e o texto, sem dados de '
        'pagamento', (tester) async {
      await _pumpPage(tester, _Fakes());

      expect(find.text(PaymentStep.title), findsOneWidget);
      expect(find.text(PaymentStep.simulatedBadge), findsOneWidget);
      expect(find.text(PaymentStep.message), findsOneWidget);
      expect(find.textContaining('Pix'), findsNothing);
    });

    testWidgets('linhas com "× n" e o total; totais com "Entrega de bike"', (
      tester,
    ) async {
      await _pumpPage(tester, _Fakes());

      expect(find.text(CheckoutSummary.title), findsOneWidget);
      expect(find.text(canetaLine.name), findsOneWidget);
      expect(find.text('× 2'), findsOneWidget);
      // Total da linha e subtotal.
      expect(_inSummary(find.text('R\$ 25,80')), findsNWidgets(2));
      expect(find.text(CartSummary.checkoutDeliveryLabel), findsOneWidget);
      expect(find.text('R\$ 4,90'), findsOneWidget);
      expect(find.text('R\$ 30,70'), findsOneWidget);
      expect(find.textContaining('Faltam'), findsNothing);
    });

    testWidgets('linha "Indisponível" com "Remover" tira o produto', (
      tester,
    ) async {
      final fakes = _Fakes(cart: stateOf([canetaLine, unavailableLine]));
      await _pumpPage(tester, fakes);

      expect(find.text(CheckoutLineTile.unavailableLabel), findsOneWidget);

      await tester.tap(find.text(CheckoutLineTile.removeLabel));
      await tester.pumpAndSettle();

      expect(fakes.cart.removeCalls, [unavailableLine.productId]);
      expect(find.text(unavailableLine.name), findsNothing);
    });

    testWidgets('"Remover" que falha mostra a mensagem', (tester) async {
      final fakes = _Fakes(cart: stateOf([canetaLine, unavailableLine]));
      fakes.cart.enqueueRemove(const Failure(_productUnavailable));
      await _pumpPage(tester, fakes);

      await tester.tap(find.text(CheckoutLineTile.removeLabel));
      await tester.pumpAndSettle();

      expect(find.text(_productUnavailable.message), findsOneWidget);
      expect(find.text(unavailableLine.name), findsOneWidget);
    });

    testWidgets('antes da primeira resposta, o resumo mostra o skeleton', (
      tester,
    ) async {
      await _pumpPage(tester, _Fakes(cart: CartState(isRestoring: true)));

      expect(_inSummary(find.byType(SkeletonBox)), findsWidgets);
      expect(find.byType(CheckoutLineTile), findsNothing);
      expect(find.byType(CartSummary), findsNothing);
    });

    testWidgets('falha da carga mostra o banner e "Tentar de novo" relê', (
      tester,
    ) async {
      final fakes = _Fakes(
        cart: stateOf([canetaLine]).copyWith(previewFailure: _noConnection),
      );
      await _pumpPage(tester, fakes);

      expect(find.text(CheckoutSummary.errorTitle), findsOneWidget);
      expect(find.byType(CheckoutLineTile), findsNothing);
      expect(fakes.cart.refreshCalls, 1);

      await tester.tap(_inSummary(find.text('Tentar de novo')));

      expect(fakes.cart.refreshCalls, 2);
    });

    testWidgets('vazio mostra a mensagem e "Voltar para a loja" abre o '
        'Início', (tester) async {
      final fakes = _Fakes(cart: CartState());
      final navigation = await _pumpPage(tester, fakes);

      expect(find.text(CheckoutSummary.emptyTitle), findsOneWidget);
      expect(find.byType(CartSummary), findsNothing);

      await tester.tap(find.text(CheckoutSummary.emptyAction));

      expect(navigation.stores, 1);
    });
  });

  group('rodapé', () {
    testWidgets('sem cadastro, desabilitado e com o aviso', (tester) async {
      await _pumpPage(tester, _Fakes(customer: null));

      expect(_enabled(tester, _confirmButton), isFalse);
      expect(find.text(CheckoutPage.deliveryHint), findsOneWidget);
      expect(find.text(CheckoutPage.unavailableHint), findsNothing);
      expect(find.text(CheckoutPage.termsNote), findsOneWidget);
    });

    testWidgets('com linha indisponível, desabilitado e com o aviso', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        _Fakes(cart: stateOf([canetaLine, unavailableLine])),
      );

      expect(_enabled(tester, _confirmButton), isFalse);
      expect(find.text(CheckoutPage.unavailableHint), findsOneWidget);
      expect(find.text(CheckoutPage.deliveryHint), findsNothing);
    });

    testWidgets('com tudo pronto, habilitado e sem avisos', (tester) async {
      await _pumpPage(tester, _Fakes());

      expect(_enabled(tester, _confirmButton), isTrue);
      expect(find.text(CheckoutPage.deliveryHint), findsNothing);
      expect(find.text(CheckoutPage.unavailableHint), findsNothing);
      expect(find.text(CheckoutPage.termsNote), findsOneWidget);
    });

    testWidgets('confirmar envia, mostra "Confirmando…" e, no sucesso, o '
        'número do pedido e a navegação', (tester) async {
      final fakes = _Fakes();
      final pending = fakes.orders.holdPlace();
      final navigation = await _pumpPage(tester, fakes);

      await tester.enterText(
        _field(OrderNoteFields.instructionsLabel),
        'Deixar na recepção',
      );
      await tester.tap(_confirmButton);
      await tester.pump();

      final confirming = find.widgetWithText(
        AppButton,
        CheckoutPage.confirmingLabel,
      );
      expect(confirming, findsOneWidget);
      expect(_enabled(tester, confirming), isFalse);
      expect(fakes.orders.placeCalls, [
        (
          recipientName: 'Ana Souza',
          deliveryInstructions: 'Deixar na recepção',
        ),
      ]);

      pending.complete(const Ok(PlacedOrder(fakePlacedOrderId)));
      await tester.pumpAndSettle();

      expect(find.text('Pedido #3F1C9A52 recebido'), findsOneWidget);
      expect(find.text(CheckoutPage.paymentPendingMessage), findsOneWidget);
      expect(navigation.placed, [fakePlacedOrderId]);
      expect(fakes.orders.placeCalls, hasLength(1));
      // Aberta e depois do pedido: o app relê, nunca esvazia.
      expect(fakes.cart.refreshCalls, 2);
      expect(fakes.cart.clearCalls, 0);
    });

    testWidgets('recusa mostra a mensagem e continua na tela', (tester) async {
      final fakes = _Fakes();
      fakes.orders.enqueuePlace(Failure(_customerInactive));
      final navigation = await _pumpPage(tester, fakes);

      await tester.tap(_confirmButton);
      await tester.pumpAndSettle();

      expect(
        find.text('Seu cadastro está inativo. Fale com o atendimento.'),
        findsOneWidget,
      );
      expect(navigation.placed, isEmpty);
      expect(find.text(CheckoutPage.title), findsOneWidget);
      expect(
        tester
            .widget<TextField>(_field(OrderNoteFields.recipientLabel))
            .controller!
            .text,
        'Ana Souza',
      );
      expect(fakes.customers.fetchCalls, 2);
      expect(fakes.cart.refreshCalls, 2);
      expect(_enabled(tester, _confirmButton), isTrue);
    });
  });
}
