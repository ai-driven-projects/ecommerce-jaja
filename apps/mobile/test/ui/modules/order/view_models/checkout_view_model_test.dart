import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';
import 'package:mobile/modules/customer/model/customer_entity.dart';
import 'package:mobile/modules/order/errors/order_errors.dart';
import 'package:mobile/modules/order/model/placed_order.dart';
import 'package:mobile/ui/modules/order/view_models/checkout_view_model.dart';
import 'package:mobile/ui/shared/view_models/block_state.dart';

import '../../../../modules/auth/support/auth_fixtures.dart';
import '../../../../modules/auth/support/fake_auth_repository.dart';
import '../../../../modules/cart/support/cart_fixtures.dart';
import '../../../../modules/cart/support/fake_cart_repository.dart';
import '../../../../modules/customer/support/customer_fixtures.dart';
import '../../../../modules/customer/support/fake_customer_repository.dart';
import '../../../../modules/order/support/fake_order_repository.dart';

const _serverDown = ServerFailure(
  message:
      'O servidor está indisponível no momento. Tente novamente em '
      'instantes.',
  code: HttpFailureCode.server,
);

/// A recusa como o `ApiOrderRepository` a devolve: texto do código conhecido,
/// mantendo `statusCode` e `codes`.
BackendRejectionFailure _rejection(OrderErrorCode code) =>
    BackendRejectionFailure(
      message: code.message,
      code: code,
      statusCode: 400,
      codes: [code.backendCode],
    );

void main() {
  late FakeCartRepository cart;
  late FakeCustomerRepository customers;
  late FakeAuthRepository auth;
  late FakeOrderRepository orders;
  late CheckoutViewModel viewModel;

  CheckoutViewModel build() {
    viewModel = CheckoutViewModel(cart, customers, auth, orders);
    return viewModel;
  }

  /// Troca o carrinho do `setUp` por um com [state].
  void useCart(CartState state) {
    cart.dispose();
    cart = FakeCartRepository(state: state);
  }

  /// Abre a tela e espera a consulta do cadastro voltar.
  Future<CheckoutViewModel> opened() async {
    build().open();
    await pumpEventQueue();
    return viewModel;
  }

  setUp(() {
    cart = FakeCartRepository(state: stateOf([canetaLine]));
    customers = FakeCustomerRepository(mine: fortalezaCustomer);
    auth = FakeAuthRepository(currentUser: ana);
    orders = FakeOrderRepository();
  });

  tearDown(() {
    viewModel.dispose();
    cart.dispose();
    auth.dispose();
  });

  group('abertura', () {
    test('open relê o carrinho uma vez e consulta o cadastro', () async {
      build();
      expect(cart.refreshCalls, 0);
      expect(customers.fetchCalls, 0);

      viewModel.open();
      expect(viewModel.customer, isA<BlockLoading<Customer?>>());
      await pumpEventQueue();

      expect(cart.refreshCalls, 1);
      expect(customers.fetchCalls, 1);
      expect(
        viewModel.customer,
        isA<BlockLoaded<Customer?>>().having(
          (state) => state.value,
          'value',
          fortalezaCustomer,
        ),
      );
    });

    test('"Quem recebe" começa com o nome da conta e as instruções, '
        'vazias', () {
      build();

      expect(viewModel.recipientName, 'Ana Souza');
      expect(viewModel.instructions, '');
    });

    test('sem usuário na sessão, "Quem recebe" começa vazio', () {
      auth.dispose();
      auth = FakeAuthRepository();
      build();

      expect(viewModel.recipientName, '');
    });

    test('começa com o estado do carrinho e acompanha as mudanças', () async {
      build();
      expect(viewModel.cart, same(cart.state));
      var notifications = 0;
      viewModel.addListener(() => notifications++);
      final next = stateOf([canetaLine, tonerLine]);

      cart.emit(next);
      await pumpEventQueue();

      expect(viewModel.cart, same(next));
      expect(notifications, 1);
    });

    test('depois do dispose, a mudança do carrinho não chega mais', () async {
      final disposed = build()..dispose();
      build();

      cart.emit(stateOf([tonerLine]));
      await pumpEventQueue();

      expect(disposed.cart.lines, [canetaLine]);
    });

    test('loadCustomer consulta de novo e vale só a última resposta', () async {
      await opened();
      final slow = customers.holdFetch();
      customers.enqueueFetch(const Ok(null));

      final first = viewModel.loadCustomer();
      final second = viewModel.loadCustomer();
      await second;
      slow.complete(const Ok(fortalezaCustomer));
      await first;

      expect(customers.fetchCalls, 3);
      expect(
        viewModel.customer,
        isA<BlockLoaded<Customer?>>().having(
          (state) => state.value,
          'value',
          isNull,
        ),
      );
    });

    test('falha da consulta do cadastro vira BlockFailed', () async {
      customers.enqueueFetch(const Failure(_serverDown));

      await opened();

      expect(
        viewModel.customer,
        isA<BlockFailed<Customer?>>().having(
          (state) => state.failure,
          'failure',
          _serverDown,
        ),
      );
    });

    test('updateRecipientName e updateInstructions trocam os textos e '
        'avisam', () {
      build();
      var notifications = 0;
      viewModel.addListener(() => notifications++);

      viewModel.updateRecipientName('Bruno Lima');
      viewModel.updateInstructions('Deixar na recepção');
      viewModel.updateInstructions('Deixar na recepção');

      expect(viewModel.recipientName, 'Bruno Lima');
      expect(viewModel.instructions, 'Deixar na recepção');
      expect(notifications, 2);
    });
  });

  group('canConfirm', () {
    test('tudo pronto habilita, sem nenhum dos avisos', () async {
      await opened();

      expect(viewModel.cartReady, isTrue);
      expect(viewModel.deliveryReady, isTrue);
      expect(viewModel.canConfirm, isTrue);
      expect(viewModel.showsUnavailableHint, isFalse);
      expect(viewModel.showsDeliveryHint, isFalse);
    });

    group('desabilita com o carrinho', () {
      Future<void> expectBlocked(CartState state) async {
        useCart(state);
        await opened();

        expect(viewModel.cartReady, isFalse);
        expect(viewModel.deliveryReady, isTrue);
        expect(viewModel.canConfirm, isFalse);
      }

      test('restaurando', () async {
        await expectBlocked(stateOf([canetaLine]).copyWith(isRestoring: true));
      });

      test('esperando a primeira resposta', () async {
        await expectBlocked(
          stateOf([canetaLine]).copyWith(detail: detailOf(const [])),
        );
      });

      test('com falha da carga', () async {
        await expectBlocked(
          stateOf([canetaLine]).copyWith(previewFailure: _serverDown),
        );
      });

      test('vazio', () async {
        await expectBlocked(CartState());
      });

      test('com mudança não confirmada', () async {
        await expectBlocked(stateOf([canetaLine]).copyWith(isSyncing: true));
      });

      test('com linha indisponível', () async {
        await expectBlocked(stateOf([canetaLine, unavailableLine]));
      });
    });

    group('desabilita com o cadastro', () {
      test('carregando', () async {
        customers.holdFetch();
        await opened();

        expect(viewModel.deliveryReady, isFalse);
        expect(viewModel.canConfirm, isFalse);
        expect(viewModel.showsDeliveryHint, isFalse);
      });

      test('sem cadastro', () async {
        customers.mine = null;
        await opened();

        expect(viewModel.cartReady, isTrue);
        expect(viewModel.deliveryReady, isFalse);
        expect(viewModel.canConfirm, isFalse);
      });

      test('com falha da consulta', () async {
        customers.enqueueFetch(const Failure(_serverDown));
        await opened();

        expect(viewModel.deliveryReady, isFalse);
        expect(viewModel.canConfirm, isFalse);
        expect(viewModel.showsDeliveryHint, isFalse);
      });
    });

    test('desabilita enquanto o pedido é enviado', () async {
      await opened();
      final placing = orders.holdPlace();

      final confirming = viewModel.confirm.execute();
      expect(viewModel.canConfirm, isFalse);

      placing.complete(const Ok(PlacedOrder(fakePlacedOrderId)));
      await confirming;
    });

    test('o aviso de indisponíveis aparece só com linha indisponível '
        'exibida', () async {
      useCart(stateOf([canetaLine, unavailableLine]));
      await opened();

      expect(viewModel.showsUnavailableHint, isTrue);
      expect(viewModel.showsDeliveryHint, isFalse);

      cart.emit(
        stateOf([
          canetaLine,
          unavailableLine,
        ]).copyWith(previewFailure: _serverDown),
      );
      await pumpEventQueue();

      expect(viewModel.showsUnavailableHint, isFalse);
    });

    test('o aviso dos dados de entrega aparece só sem cadastro', () async {
      customers.mine = null;
      await opened();

      expect(viewModel.showsDeliveryHint, isTrue);
      expect(viewModel.showsUnavailableHint, isFalse);
    });
  });

  group('confirm', () {
    test('envia o nome e as instruções digitados', () async {
      await opened();
      viewModel.updateRecipientName('  Bruno Lima ');
      viewModel.updateInstructions('Deixar na recepção');

      await viewModel.confirm.execute();

      expect(orders.placeCalls, [
        (
          recipientName: '  Bruno Lima ',
          deliveryInstructions: 'Deixar na recepção',
        ),
      ]);
    });

    test('sem mudar nada, envia o nome da conta e instruções vazias', () async {
      await opened();

      await viewModel.confirm.execute();

      expect(orders.placeCalls, [
        (recipientName: 'Ana Souza', deliveryInstructions: ''),
      ]);
    });

    test('sucesso devolve o PlacedOrder e relê o carrinho, sem '
        'esvaziá-lo', () async {
      await opened();

      await viewModel.confirm.execute();

      expect(
        viewModel.confirm.result,
        isA<Ok<PlacedOrder>>().having(
          (result) => result.value,
          'value',
          const PlacedOrder(fakePlacedOrderId),
        ),
      );
      expect(cart.refreshCalls, 2);
      expect(cart.clearCalls, 0);
      expect(customers.fetchCalls, 1);
      expect(viewModel.failureMessage, isNull);
    });

    test('enquanto espera, fica running e um segundo execute não '
        'envia', () async {
      await opened();
      final placing = orders.holdPlace();

      final confirming = viewModel.confirm.execute();
      expect(viewModel.confirm.running, isTrue);
      await viewModel.confirm.execute();

      expect(orders.placeCalls, hasLength(1));
      expect(viewModel.confirm.running, isTrue);

      placing.complete(const Ok(PlacedOrder(fakePlacedOrderId)));
      await confirming;

      expect(viewModel.confirm.running, isFalse);
      expect(orders.placeCalls, hasLength(1));
    });

    test('sem as condições, nada é enviado', () async {
      customers.mine = null;
      await opened();

      await viewModel.confirm.execute();

      expect(orders.placeCalls, isEmpty);
      expect(viewModel.confirm.result, isA<Failure<PlacedOrder>>());
      expect(cart.refreshCalls, 1);
    });
  });

  group('falhas', () {
    test('ORDER_CUSTOMER_INACTIVE mostra a mensagem, relê o carrinho e '
        'consulta o cadastro de novo', () async {
      await opened();
      viewModel.updateInstructions('Deixar na recepção');
      orders.enqueuePlace(Failure(_rejection(OrderErrorCode.customerInactive)));

      await viewModel.confirm.execute();
      await pumpEventQueue();

      expect(
        viewModel.failureMessage,
        'Seu cadastro está inativo. Fale com o atendimento.',
      );
      expect(cart.refreshCalls, 2);
      expect(customers.fetchCalls, 2);
      expect(viewModel.instructions, 'Deixar na recepção');
      expect(viewModel.recipientName, 'Ana Souza');
    });

    test('ORDER_CART_HAS_UNAVAILABLE_ITEMS relê o carrinho sem consultar o '
        'cadastro', () async {
      await opened();
      orders.enqueuePlace(
        Failure(_rejection(OrderErrorCode.cartHasUnavailableItems)),
      );

      await viewModel.confirm.execute();
      await pumpEventQueue();

      expect(
        viewModel.failureMessage,
        'Remova os itens indisponíveis para confirmar o pedido.',
      );
      expect(cart.refreshCalls, 2);
      expect(customers.fetchCalls, 1);
    });

    test(
      'falha do servidor mantém a mensagem dela e relê o carrinho',
      () async {
        await opened();
        orders.enqueuePlace(const Failure(_serverDown));

        await viewModel.confirm.execute();

        expect(viewModel.failureMessage, _serverDown.message);
        expect(cart.refreshCalls, 2);
        expect(customers.fetchCalls, 1);
      },
    );

    test('a próxima ação limpa a mensagem anterior', () async {
      await opened();
      orders.enqueuePlace(const Failure(_serverDown));
      await viewModel.confirm.execute();

      await viewModel.confirm.execute();

      expect(viewModel.failureMessage, isNull);
    });

    test('removeLine tira o produto do carrinho', () async {
      useCart(stateOf([canetaLine, unavailableLine]));
      await opened();

      await viewModel.removeLine.execute(unavailableLine.productId);
      await pumpEventQueue();

      expect(cart.removeCalls, [unavailableLine.productId]);
      expect(viewModel.removeLine.result, isA<Ok<void>>());
      expect(viewModel.failureMessage, isNull);
    });

    test('removeLine com falha preenche failureMessage', () async {
      useCart(stateOf([canetaLine, unavailableLine]));
      await opened();
      cart.enqueueRemove(
        Failure(
          NotFoundFailure(
            message: CartErrorCode.productUnavailable.message,
            code: CartErrorCode.productUnavailable,
          ),
        ),
      );

      await viewModel.removeLine.execute(unavailableLine.productId);

      expect(
        viewModel.failureMessage,
        CartErrorCode.productUnavailable.message,
      );
      expect(viewModel.cart.quantityOf(unavailableLine.productId), 1);
    });
  });
}
