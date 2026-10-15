import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';
import 'package:mobile/ui/modules/cart/pages/cart_page.dart';
import 'package:mobile/ui/modules/cart/view_models/cart_view_model.dart';
import 'package:mobile/ui/modules/cart/widgets/cart_line_tile.dart';
import 'package:mobile/ui/modules/cart/widgets/cart_summary.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';
import 'package:mobile/ui/shared/widgets/empty_state.dart';
import 'package:mobile/ui/shared/widgets/quantity_stepper.dart';
import 'package:mobile/ui/shared/widgets/state_error_banner.dart';

import '../../../../modules/cart/support/cart_fixtures.dart';
import '../../../../modules/cart/support/fake_cart_repository.dart';
import '../../../shared/support/money.dart';

const _previewFailure = NetworkFailure(
  message: 'Sem conexão com a internet.',
  code: HttpFailureCode.noConnection,
);

const _mergeFailure = ServerFailure(
  message: 'Algo deu errado do nosso lado. Tente de novo em instantes.',
  code: HttpFailureCode.server,
);

const _productUnavailable = NotFoundFailure(
  message: 'Produto indisponível.',
  code: CartErrorCode.productUnavailable,
);

final _quantityExceeded = ValidationFailure(
  message: CartErrorCode.quantityExceeded.message,
  code: CartErrorCode.quantityExceeded,
);

/// Uma caneta só: 1 × R\$ 12,90.
final _singleCaneta = canetaLine.copyWith(quantity: 1, lineTotal: money(1290));

/// Navegação pedida pela página, na ordem.
class _Navigation {
  final List<String> products = [];
  int searches = 0;
}

Future<_Navigation> _pumpPage(
  WidgetTester tester,
  FakeCartRepository repository,
) async {
  final navigation = _Navigation();
  addTearDown(repository.dispose);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: CartPage(
        cartViewModelFactory: () => CartViewModel(repository),
        onOpenProduct: navigation.products.add,
        onOpenSearch: () => navigation.searches++,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return navigation;
}

Finder get _checkoutButton =>
    find.widgetWithText(AppButton, 'Finalizar pedido · R\$ 30,70');

void main() {
  testWidgets('restaurando o carrinho mostra o skeleton', (tester) async {
    await _pumpPage(
      tester,
      FakeCartRepository(state: CartState(isRestoring: true)),
    );

    expect(find.text(CartPage.title), findsOneWidget);
    expect(find.bySemanticsLabel('Carregando'), findsOneWidget);
    expect(find.byType(EmptyState), findsNothing);
    expect(find.byType(CartLineTile), findsNothing);
    expect(find.byType(AppButton), findsNothing);
  });

  testWidgets('com itens e sem a primeira prévia mostra o skeleton', (
    tester,
  ) async {
    await _pumpPage(
      tester,
      FakeCartRepository(
        state: CartState(
          items: [CartItem(productId: canetaLine.productId, quantity: 2)],
        ),
      ),
    );

    expect(find.bySemanticsLabel('Carregando'), findsOneWidget);
    expect(find.byType(CartLineTile), findsNothing);
    expect(find.byType(CartSummary), findsNothing);
  });

  testWidgets('vazio mostra a mensagem e "Ver produtos" abre a Buscar', (
    tester,
  ) async {
    final navigation = await _pumpPage(tester, FakeCartRepository());

    expect(find.text(CartPage.emptyTitle), findsOneWidget);
    expect(find.text(CartPage.emptyMessage), findsOneWidget);
    expect(find.byType(CartSummary), findsNothing);
    expect(find.textContaining('Finalizar pedido'), findsNothing);

    await tester.tap(find.text(CartPage.emptyAction));

    expect(navigation.searches, 1);
  });

  testWidgets('falha da prévia mostra o banner e "Tentar de novo" pede a '
      'prévia', (tester) async {
    final repository = FakeCartRepository(
      state: stateOf([canetaLine]).copyWith(previewFailure: _previewFailure),
    );
    await _pumpPage(tester, repository);

    expect(find.byType(StateErrorBanner), findsOneWidget);
    expect(find.text(CartPage.errorTitle), findsOneWidget);
    expect(find.text(_previewFailure.message), findsOneWidget);
    expect(find.byType(CartLineTile), findsNothing);
    expect(find.byType(CartSummary), findsNothing);
    expect(find.textContaining('Finalizar pedido'), findsNothing);

    await tester.tap(find.text('Tentar de novo'));

    expect(repository.refreshCalls, 1);
  });

  testWidgets('falha na carga sem itens mostra o banner, não o vazio', (
    tester,
  ) async {
    final repository = FakeCartRepository(
      state: CartState(
        detail: CartDetail.empty(),
        previewFailure: _previewFailure,
      ),
    );
    await _pumpPage(tester, repository);

    expect(find.text(CartPage.errorTitle), findsOneWidget);
    expect(find.text(_previewFailure.message), findsOneWidget);
    expect(find.byType(EmptyState), findsNothing);

    await tester.tap(find.text('Tentar de novo'));

    expect(repository.refreshCalls, 1);
  });

  testWidgets('falha na mescla mostra o aviso acima das linhas e "Tentar de '
      'novo" pede o refresh', (tester) async {
    final repository = FakeCartRepository(
      state: stateOf([canetaLine]).copyWith(mergeFailure: _mergeFailure),
    );
    await _pumpPage(tester, repository);

    expect(find.text(CartPage.mergeErrorTitle), findsOneWidget);
    expect(find.text(_mergeFailure.message), findsOneWidget);
    expect(find.text(canetaLine.name), findsOneWidget);
    expect(
      tester.getTopLeft(find.text(CartPage.mergeErrorTitle)).dy,
      lessThan(tester.getTopLeft(find.byType(CartLineTile)).dy),
    );

    await tester.tap(find.text('Tentar de novo'));

    expect(repository.refreshCalls, 1);
  });

  testWidgets('falha na mescla com a conta vazia mostra o aviso acima do '
      'vazio', (tester) async {
    final repository = FakeCartRepository(
      state: CartState(detail: CartDetail.empty(), mergeFailure: _mergeFailure),
    );
    await _pumpPage(tester, repository);

    expect(find.text(CartPage.mergeErrorTitle), findsOneWidget);
    expect(find.text(CartPage.emptyTitle), findsOneWidget);
    expect(
      tester.getTopLeft(find.text(CartPage.mergeErrorTitle)).dy,
      lessThan(tester.getTopLeft(find.byType(EmptyState)).dy),
    );
  });

  testWidgets('falha na mescla não aparece durante o skeleton', (tester) async {
    await _pumpPage(
      tester,
      FakeCartRepository(
        state: CartState(isRestoring: true, mergeFailure: _mergeFailure),
      ),
    );

    expect(find.bySemanticsLabel('Carregando'), findsOneWidget);
    expect(find.text(CartPage.mergeErrorTitle), findsNothing);
  });

  testWidgets('mostra as linhas na ordem, o resumo e "Finalizar pedido" '
      'desabilitado', (tester) async {
    await _pumpPage(tester, FakeCartRepository(state: stateOf([canetaLine])));

    expect(find.byType(CartLineTile), findsOneWidget);
    expect(find.text(canetaLine.name), findsOneWidget);
    expect(find.byType(CartSummary), findsOneWidget);
    expect(find.text('R\$ 4,90'), findsOneWidget);
    expect(
      find.text('Faltam R\$ 53,20 para a entrega grátis.'),
      findsOneWidget,
    );
    expect(_checkoutButton, findsOneWidget);
    expect(tester.widget<AppButton>(_checkoutButton).onPressed, isNull);
  });

  testWidgets('as linhas seguem a ordem de inclusão', (tester) async {
    await _pumpPage(
      tester,
      FakeCartRepository(state: stateOf([tonerLine, canetaLine])),
    );

    final tiles = tester
        .widgetList<CartLineTile>(find.byType(CartLineTile))
        .map((tile) => tile.line.productId);
    expect(tiles, [tonerLine.productId, canetaLine.productId]);
  });

  testWidgets('"+" muda a quantidade e o total da linha na hora', (
    tester,
  ) async {
    final repository = FakeCartRepository(state: stateOf([_singleCaneta]));
    await _pumpPage(tester, repository);
    expect(find.text('R\$ 25,80'), findsNothing);

    await tester.tap(
      find.bySemanticsLabel(QuantityStepper.incrementLabel(canetaLine.name)),
    );
    await tester.pumpAndSettle();

    expect(repository.setQuantityCalls, [
      (productId: canetaLine.productId, quantity: 2),
    ]);
    expect(find.text('R\$ 25,80'), findsOneWidget);
  });

  testWidgets('"−" no único produto com quantidade 1 mostra o vazio', (
    tester,
  ) async {
    await _pumpPage(
      tester,
      FakeCartRepository(state: stateOf([_singleCaneta])),
    );

    await tester.tap(
      find.bySemanticsLabel(QuantityStepper.decrementLabel(canetaLine.name)),
    );
    await tester.pumpAndSettle();

    expect(find.byType(CartLineTile), findsNothing);
    expect(find.text(CartPage.emptyTitle), findsOneWidget);
  });

  testWidgets('a lixeira tira o produto do carrinho', (tester) async {
    final repository = FakeCartRepository(
      state: stateOf([tonerLine, canetaLine]),
    );
    await _pumpPage(tester, repository);

    await tester.tap(
      find.byTooltip(CartLineTile.removeTooltip(tonerLine.name)),
    );
    await tester.pumpAndSettle();

    expect(repository.removeCalls, [tonerLine.productId]);
    expect(find.text(tonerLine.name), findsNothing);
    expect(find.text(canetaLine.name), findsOneWidget);
  });

  testWidgets('falha de regra mostra a mensagem no SnackBar', (tester) async {
    final repository = FakeCartRepository(state: stateOf([canetaLine]))
      ..enqueueSetQuantity(Failure(_quantityExceeded));
    await _pumpPage(tester, repository);

    await tester.tap(
      find.bySemanticsLabel(QuantityStepper.incrementLabel(canetaLine.name)),
    );
    await tester.pump();

    expect(find.byType(SnackBar), findsOneWidget);
    expect(find.text('Limite de 99 unidades por produto.'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
  });

  testWidgets('falha da lixeira mostra a mensagem no SnackBar', (tester) async {
    final repository = FakeCartRepository(state: stateOf([canetaLine]))
      ..enqueueRemove(const Failure(_productUnavailable));
    await _pumpPage(tester, repository);

    await tester.tap(
      find.byTooltip(CartLineTile.removeTooltip(canetaLine.name)),
    );
    await tester.pump();

    expect(repository.removeCalls, [canetaLine.productId]);
    expect(find.byType(SnackBar), findsOneWidget);
    expect(find.text('Produto indisponível.'), findsOneWidget);
    expect(find.text(canetaLine.name), findsOneWidget);
  });

  testWidgets('tocar no nome de uma linha abre o produto pelo slug', (
    tester,
  ) async {
    final navigation = await _pumpPage(
      tester,
      FakeCartRepository(state: stateOf([canetaLine])),
    );

    await tester.tap(find.text(canetaLine.name));

    expect(navigation.products, [canetaLine.slug]);
  });

  testWidgets('com mudança pendente, o resumo aparece como "Atualizando"', (
    tester,
  ) async {
    await _pumpPage(
      tester,
      FakeCartRepository(
        state: stateOf([canetaLine]).copyWith(isSyncing: true),
      ),
    );

    expect(
      find.bySemanticsLabel(RegExp(CartSummary.syncingLabel)),
      findsOneWidget,
    );
  });
}
