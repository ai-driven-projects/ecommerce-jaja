import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile/app/router/app_router.dart';
import 'package:mobile/app/router/app_routes.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/infra/auth/session.dart';
import 'package:mobile/infra/di/service_locator.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_query_params.dart';
import 'package:mobile/modules/catalog/provider/catalog_repository.dart';
import 'package:mobile/ui/modules/auth/pages/account_page.dart';
import 'package:mobile/ui/modules/auth/pages/login_page.dart';
import 'package:mobile/ui/modules/auth/pages/register_page.dart';
import 'package:mobile/ui/modules/cart/pages/cart_page.dart';
import 'package:mobile/ui/modules/cart/widgets/cart_line_tile.dart';
import 'package:mobile/ui/modules/catalog/pages/home_page.dart';
import 'package:mobile/ui/modules/catalog/pages/product_detail_page.dart';
import 'package:mobile/ui/modules/catalog/pages/search_page.dart';
import 'package:mobile/ui/modules/catalog/view_models/search_view_model.dart';
import 'package:mobile/ui/modules/catalog/widgets/filters_sheet.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_grid.dart';
import 'package:mobile/ui/modules/customer/pages/delivery_details_page.dart';
import 'package:mobile/ui/modules/customer/widgets/address_fields.dart';
import 'package:mobile/ui/modules/order/pages/checkout_page.dart';
import 'package:mobile/ui/modules/order/pages/order_placed_page.dart';
import 'package:mobile/ui/modules/order/widgets/delivery_step.dart';
import 'package:mobile/ui/shared/pages/splash_page.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';
import 'package:mobile/ui/shared/widgets/app_text_field.dart';
import 'package:mobile/ui/shared/widgets/product_card.dart';

import '../../modules/auth/support/auth_fixtures.dart';
import '../../modules/auth/support/fake_auth_repository.dart';
import '../../modules/cart/support/cart_fixtures.dart';
import '../../modules/cart/support/fake_cart_repository.dart';
import '../../modules/catalog/support/catalog_fixtures.dart';
import '../../modules/catalog/support/fake_catalog_repository.dart';
import '../../modules/customer/support/customer_fixtures.dart';
import '../../modules/customer/support/fake_customer_repository.dart';
import '../../modules/order/support/fake_order_repository.dart';
import '../../ui/shared/support/money.dart';
import '../support/fake_dependencies.dart';

Future<GoRouter> _pumpRouter(
  WidgetTester tester, {
  String initialLocation = AppRoutes.home,
  bool settle = true,
}) async {
  final router = buildAppRouter(initialLocation: initialLocation);
  addTearDown(router.dispose);
  await tester.pumpWidget(
    MaterialApp.router(routerConfig: router, theme: AppTheme.light()),
  );
  // O splash gira sem parar: com a sessão desconhecida, só um quadro.
  settle ? await tester.pumpAndSettle() : await tester.pump();
  return router;
}

/// Troca a sessão registrada pelo `setUp` por [auth], antes de montar o app.
Future<void> _useSession(FakeAuthRepository auth) async {
  await resetDependencies();
  registerFakeDependencies(auth: auth);
}

/// Troca o carrinho registrado pelo `setUp` por [cart], antes de montar o app.
Future<void> _useCart(FakeCartRepository cart) async {
  await resetDependencies();
  registerFakeDependencies(cart: cart);
}

/// Carrinho pronto para o checkout (uma linha, 2 × caneta, total R\$ 30,70),
/// com a sessão da [ana] e o cadastro de Fortaleza, antes de montar o app.
/// Devolve os fakes de pedido e de cadastro.
Future<({FakeOrderRepository orders, FakeCustomerRepository customers})>
_useCheckout(WidgetTester tester) async {
  // Alta para o formulário dos dados de entrega caber sem rolar.
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final orders = FakeOrderRepository();
  final customers = FakeCustomerRepository(mine: fortalezaCustomer);
  await resetDependencies();
  registerFakeDependencies(
    auth: FakeAuthRepository(currentUser: ana),
    cart: FakeCartRepository(state: stateOf([canetaLine])),
    customer: customers,
    order: orders,
  );
  return (orders: orders, customers: customers);
}

Finder get _openCheckoutButton =>
    find.widgetWithText(AppButton, CartPage.checkoutLabel(money(3070)));

FakeAuthRepository get _session => getIt<Session>() as FakeAuthRepository;

Future<void> _enterText(WidgetTester tester, String label, String text) =>
    tester.enterText(
      find.descendant(
        of: find.widgetWithText(AppTextField, label),
        matching: find.byType(TextField),
      ),
      text,
    );

/// Preenche e envia "Entrar"; o fake devolve a [ana] e avisa a guarda.
Future<void> _signIn(WidgetTester tester) async {
  await _enterText(tester, LoginPage.emailLabel, 'ana@exemplo.com');
  await _enterText(tester, LoginPage.passwordLabel, '#Senha123');
  await tester.tap(find.widgetWithText(AppButton, LoginPage.submitLabel));
  // O `userChanges` é broadcast: só o `pumpAndSettle` entrega o evento.
  await tester.pumpAndSettle();
}

/// Abre a aba Conta sem sessão e toca em "Entrar".
Future<GoRouter> _openLoginFromAccount(WidgetTester tester) async {
  final router = await _pumpRouter(tester, initialLocation: AppRoutes.account);
  await tester.tap(find.widgetWithText(AppButton, AccountPage.loginLabel));
  await tester.pumpAndSettle();
  return router;
}

String _location(GoRouter router) =>
    router.routerDelegate.currentConfiguration.uri.path;

/// Caminho da tela do topo: a rota aberta com `push` não muda o
/// [_location], que continua sendo o da rota de base.
String _topLocation(GoRouter router) {
  final top = router.routerDelegate.currentConfiguration.lastOrNull;
  return top is ImperativeRouteMatch ? top.matches.uri.path : _location(router);
}

/// Caminho e query da localização atual, como a aba a guarda.
String _fullLocation(GoRouter router) =>
    router.routerDelegate.currentConfiguration.uri.toString();

NavigationBar _bar(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar));

FakeCatalogRepository get _catalog =>
    getIt<CatalogRepository>() as FakeCatalogRepository;

/// Troca o `registerFactory` do [SearchViewModel] por um que conta as
/// chamadas, para provar que trocar o filtro não recria o ViewModel.
List<SearchViewModel> _countSearchViewModels() {
  final created = <SearchViewModel>[];
  getIt.unregister<SearchViewModel>();
  getIt.registerFactory<SearchViewModel>(() {
    final viewModel = SearchViewModel(getIt<CatalogRepository>());
    created.add(viewModel);
    return viewModel;
  });
  return created;
}

Future<void> _tapTab(WidgetTester tester, String label) async {
  await tester.tap(
    find.descendant(of: find.byType(NavigationBar), matching: find.text(label)),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(registerFakeDependencies);
  tearDown(resetDependencies);

  group('abas', () {
    testWidgets('a barra mostra Início, Buscar, Carrinho e Conta, com Início '
        'selecionada', (tester) async {
      await _pumpRouter(tester);

      final bar = _bar(tester);
      final labels = bar.destinations
          .map((destination) => (destination as NavigationDestination).label)
          .toList();
      expect(labels, ['Início', 'Buscar', 'Carrinho', 'Conta']);
      expect(bar.selectedIndex, 0);
      expect(find.byType(HomePage), findsOneWidget);
    });

    testWidgets('tocar em Carrinho mostra o carrinho e mantém o Início montado '
        'fora da tela', (tester) async {
      final router = await _pumpRouter(tester);

      await tester.tap(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.text('Carrinho'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(CartPage), findsOneWidget);
      expect(find.byType(HomePage), findsNothing);
      expect(find.byType(HomePage, skipOffstage: false), findsOneWidget);
      expect(_bar(tester).selectedIndex, 2);
      expect(_location(router), AppRoutes.cart);
    });

    testWidgets('/ vai para /home', (tester) async {
      final router = await _pumpRouter(tester, initialLocation: '/');

      expect(_location(router), AppRoutes.home);
      expect(find.byType(HomePage), findsOneWidget);
    });
  });

  group('rotas do catálogo', () {
    testWidgets('/search?category=escolar&sort=aleatorio seleciona Buscar e '
        'entrega o filtro decodificado, sem a ordem inválida', (tester) async {
      await _pumpRouter(
        tester,
        initialLocation: '/search?category=escolar&sort=aleatorio',
      );

      expect(_bar(tester).selectedIndex, 1);
      final page = tester.widget<SearchPage>(find.byType(SearchPage));
      expect(page.initialQuery, const ProductQuery(categorySlug: 'escolar'));
      expect(page.initialQuery.sort, isNull);
      expect(encodeProductQuery(_catalog.productQueries.last), {
        'category': 'escolar',
        'page': '1',
        'pageSize': '24',
      });
    });

    testWidgets('marcar "Só ofertas" espelha o filtro na rota sem recriar o '
        'ViewModel, e voltar à aba depois da Início não pede de novo', (
      tester,
    ) async {
      final created = _countSearchViewModels();
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.search,
      );

      await tester.tap(find.text(SearchPage.filtersLabel));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text(FiltersSheet.onSaleLabel));
      await tester.pumpAndSettle();
      await tester.tap(find.text(FiltersSheet.onSaleLabel));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip(FiltersSheet.closeTooltip));
      await tester.pumpAndSettle();

      expect(_fullLocation(router), '/search?onSale=true');
      expect(created, hasLength(1));
      expect(
        tester.widget<SearchPage>(find.byType(SearchPage)).initialQuery,
        const ProductQuery(onSale: true),
      );

      await _tapTab(tester, 'Início');
      expect(find.byType(HomePage), findsOneWidget);
      final requests = _catalog.productQueries.length;

      await _tapTab(tester, 'Buscar');

      expect(_bar(tester).selectedIndex, 1);
      expect(_fullLocation(router), '/search?onSale=true');
      expect(find.text('Filtros (1)'), findsOneWidget);
      expect(_catalog.productQueries, hasLength(requests));
      expect(created, hasLength(1));
    });

    testWidgets('/home/product/caneta-x mostra a página do produto sobre a '
        'Início, com a barra de abas visível, e voltar retorna à Início', (
      tester,
    ) async {
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.productLocation('caneta-x'),
      );

      expect(_location(router), '/home/product/caneta-x');
      final page = tester.widget<ProductDetailPage>(
        find.byType(ProductDetailPage),
      );
      expect(page.slug, 'caneta-x');
      expect(_catalog.productSlugs, ['caneta-x']);
      expect(find.textContaining('Adicionar ·'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(_bar(tester).selectedIndex, 0);
      expect(find.byType(HomePage), findsNothing);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.byType(ProductDetailPage), findsNothing);
      expect(find.byType(HomePage), findsOneWidget);
      expect(_location(router), AppRoutes.home);
    });

    testWidgets('produto inexistente: "Voltar ao catálogo" abre a aba Buscar '
        'sem filtros', (tester) async {
      _catalog.enqueueProduct(
        const Failure(
          NotFoundFailure(
            message: 'Não encontramos o que você procurou.',
            code: HttpFailureCode.notFound,
          ),
        ),
      );
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.productLocation('nao-existe'),
      );

      expect(find.text(ProductDetailPage.notFoundTitle), findsOneWidget);

      await tester.tap(find.text(ProductDetailPage.notFoundAction));
      await tester.pumpAndSettle();

      expect(_fullLocation(router), AppRoutes.search);
      expect(_bar(tester).selectedIndex, 1);
      expect(
        tester.widget<SearchPage>(find.byType(SearchPage)).initialQuery,
        const ProductQuery(),
      );
    });

    testWidgets('tocar num card da Início abre o produto na pilha da aba', (
      tester,
    ) async {
      final router = await _pumpRouter(tester);

      await tester.ensureVisible(find.byType(ProductCard).first);
      await tester.pumpAndSettle();
      await tester.tap(find.byType(ProductCard).first);
      await tester.pumpAndSettle();

      final page = tester.widget<ProductDetailPage>(
        find.byType(ProductDetailPage),
      );
      expect(page.slug, finePen.slug);
      expect(_catalog.productSlugs, [finePen.slug]);
      expect(find.byType(NavigationBar), findsOneWidget);
      // `push` não muda a localização "ida" do router; o que conta é a pilha.
      expect(_location(router), AppRoutes.home);
    });

    testWidgets('tocar num card da Buscar abre o produto na pilha da aba, e '
        'voltar mostra a mesma listagem sem nova requisição', (tester) async {
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.search,
      );
      final listed = tester
          .widget<ProductGrid>(find.byType(ProductGrid))
          .products;
      final requests = _catalog.productQueries.length;

      await tester.tap(find.byType(ProductCard).first);
      await tester.pumpAndSettle();

      final page = tester.widget<ProductDetailPage>(
        find.byType(ProductDetailPage),
      );
      expect(page.slug, listed.first.slug);
      expect(_catalog.productSlugs, [listed.first.slug]);
      expect(find.textContaining('Adicionar ·'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(_bar(tester).selectedIndex, 1);
      expect(find.byType(SearchPage), findsNothing);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.byType(ProductDetailPage), findsNothing);
      expect(find.byType(SearchPage), findsOneWidget);
      expect(
        tester.widget<ProductGrid>(find.byType(ProductGrid)).products,
        listed,
      );
      expect(_catalog.productQueries, hasLength(requests));
      expect(_location(router), AppRoutes.search);
    });
  });

  group('carrinho', () {
    testWidgets('tocar no nome de uma linha abre o produto na pilha da aba '
        'Carrinho, e voltar retorna à aba', (tester) async {
      await _useCart(FakeCartRepository(state: stateOf([canetaLine])));
      final router = await _pumpRouter(tester, initialLocation: AppRoutes.cart);

      await tester.tap(find.text(canetaLine.name));
      await tester.pumpAndSettle();

      expect(_location(router), '/cart/product/${canetaLine.slug}');
      final page = tester.widget<ProductDetailPage>(
        find.byType(ProductDetailPage),
      );
      expect(page.slug, canetaLine.slug);
      expect(_catalog.productSlugs, [canetaLine.slug]);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(_bar(tester).selectedIndex, 2);
      expect(find.byType(CartPage), findsNothing);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.byType(ProductDetailPage), findsNothing);
      expect(find.byType(CartLineTile), findsOneWidget);
      expect(_bar(tester).selectedIndex, 2);
      expect(_location(router), AppRoutes.cart);
    });

    testWidgets('o badge da aba mostra a soma das quantidades do carrinho', (
      tester,
    ) async {
      await _useCart(
        FakeCartRepository(state: stateOf([canetaLine, tonerLine])),
      );
      await _pumpRouter(tester);

      expect(
        find.descendant(
          of: find.byType(NavigationBar),
          matching: find.descendant(
            of: find.byType(Badge),
            matching: find.text('3'),
          ),
        ),
        findsOneWidget,
      );
    });

    testWidgets('adicionar no detalhe aumenta o badge e "Ver carrinho" no '
        'aviso abre a aba Carrinho', (tester) async {
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.productLocation(plainDetail.slug),
      );
      final badge = find.descendant(
        of: find.byType(NavigationBar),
        matching: find.byType(Badge),
      );
      expect(tester.widget<Badge>(badge).isLabelVisible, isFalse);

      await tester.tap(
        find.widgetWithText(
          AppButton,
          ProductDetailPage.addLabel(plainDetail.price),
        ),
      );
      // O `changes` é broadcast: só o `pumpAndSettle` entrega o evento.
      await tester.pumpAndSettle();

      expect(tester.widget<Badge>(badge).isLabelVisible, isTrue);
      expect(
        find.descendant(of: badge, matching: find.text('1')),
        findsOneWidget,
      );
      expect(find.text(ProductDetailPage.addedTitle), findsOneWidget);

      await tester.tap(find.text(ProductDetailPage.openCartAction));
      await tester.pumpAndSettle();

      expect(_location(router), AppRoutes.cart);
      expect(_bar(tester).selectedIndex, 2);
      expect(find.byType(CartPage), findsOneWidget);
      expect(find.byType(ProductDetailPage), findsNothing);
    });

    testWidgets('carrinho vazio: "Ver produtos" abre a Buscar sem filtros', (
      tester,
    ) async {
      final router = await _pumpRouter(tester, initialLocation: AppRoutes.cart);

      expect(find.text(CartPage.emptyTitle), findsOneWidget);

      await tester.tap(find.text(CartPage.emptyAction));
      await tester.pumpAndSettle();

      expect(_fullLocation(router), AppRoutes.search);
      expect(_bar(tester).selectedIndex, 1);
      expect(
        tester.widget<SearchPage>(find.byType(SearchPage)).initialQuery,
        const ProductQuery(),
      );
    });
  });

  group('checkout', () {
    testWidgets('sem sessão, "Finalizar pedido" leva a "Entrar" com o '
        'checkout como destino e, depois de entrar, abre o checkout', (
      tester,
    ) async {
      await _useCart(FakeCartRepository(state: stateOf([canetaLine])));
      final router = await _pumpRouter(tester, initialLocation: AppRoutes.cart);

      await tester.tap(_openCheckoutButton);
      await tester.pumpAndSettle();

      expect(find.byType(LoginPage), findsOneWidget);
      expect(find.byType(CheckoutPage), findsNothing);
      expect(_fullLocation(router), '/login?from=%2Fcart%2Fcheckout');

      await _signIn(tester);

      expect(find.byType(LoginPage), findsNothing);
      expect(find.byType(CheckoutPage), findsOneWidget);
      expect(_location(router), AppRoutes.checkout);
    });

    testWidgets('com sessão, "Finalizar pedido" abre o checkout na pilha da '
        'aba Carrinho', (tester) async {
      await _useCheckout(tester);
      final router = await _pumpRouter(tester, initialLocation: AppRoutes.cart);

      await tester.tap(_openCheckoutButton);
      await tester.pumpAndSettle();

      expect(find.byType(CheckoutPage), findsOneWidget);
      expect(find.text(CheckoutPage.title), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(_bar(tester).selectedIndex, 2);
      expect(_location(router), AppRoutes.checkout);
    });

    testWidgets('"Alterar" abre os dados de entrega na pilha do checkout, e '
        'salvar volta ao checkout com o endereço novo', (tester) async {
      final fakes = await _useCheckout(tester);
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.checkout,
      );
      expect(fakes.customers.fetchCalls, 1);

      await tester.tap(find.text(DeliveryStep.editAction));
      await tester.pumpAndSettle();

      expect(find.byType(DeliveryDetailsPage), findsOneWidget);
      expect(_bar(tester).selectedIndex, 2);
      expect(_topLocation(router), AppRoutes.checkoutDelivery);

      await _enterText(tester, AddressFields.numberLabel, '1600');
      await tester.pump();
      await tester.tap(
        find.widgetWithText(AppButton, DeliveryDetailsPage.saveLabel),
      );
      await tester.pumpAndSettle();

      expect(fakes.customers.saveCalls.single.number, '1600');
      expect(find.byType(DeliveryDetailsPage), findsNothing);
      expect(find.byType(CheckoutPage), findsOneWidget);
      expect(_bar(tester).selectedIndex, 2);
      expect(_topLocation(router), AppRoutes.checkout);
      expect(fakes.customers.fetchCalls, 3);
      expect(
        find.textContaining('Avenida Santos Dumont, 1600 · '),
        findsOneWidget,
      );
    });

    testWidgets('confirmar com sucesso leva ao pedido na aba Carrinho, e '
        'voltar mostra o carrinho, sem o checkout', (tester) async {
      final fakes = await _useCheckout(tester);
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.checkout,
      );

      await tester.tap(
        find.widgetWithText(AppButton, CheckoutPage.confirmLabel(money(3070))),
      );
      await tester.pumpAndSettle();

      expect(fakes.orders.placeCalls, hasLength(1));
      expect(_location(router), AppRoutes.orderLocation(fakePlacedOrderId));
      expect(find.byType(OrderPlacedPage), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(OrderPlacedPage),
          matching: find.text(OrderPlacedPage.title(fakePlacedOrderId)),
        ),
        findsOneWidget,
      );
      expect(find.byType(CheckoutPage), findsNothing);
      expect(_bar(tester).selectedIndex, 2);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.byType(OrderPlacedPage), findsNothing);
      expect(find.byType(CheckoutPage), findsNothing);
      expect(find.byType(CartPage), findsOneWidget);
      expect(_bar(tester).selectedIndex, 2);
      expect(_location(router), AppRoutes.cart);
    });
  });

  group('sessão', () {
    testWidgets('sessão desconhecida mostra o splash sem a barra e, ao virar '
        'anônima, a Início', (tester) async {
      await _useSession(FakeAuthRepository(unknown: true));
      final router = await _pumpRouter(tester, settle: false);

      expect(find.byType(SplashPage), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      expect(_location(router), AppRoutes.splash);

      _session.emit(null);
      await tester.pumpAndSettle();

      expect(find.byType(SplashPage), findsNothing);
      expect(find.byType(HomePage), findsOneWidget);
      expect(_bar(tester).selectedIndex, 0);
      expect(_location(router), AppRoutes.home);
    });

    testWidgets('/login?from=/search?category=escolar com sessão vai para a '
        'Buscar filtrada', (tester) async {
      await _useSession(FakeAuthRepository(currentUser: ana));
      final router = await _pumpRouter(
        tester,
        initialLocation: '/login?from=/search?category=escolar',
      );

      expect(find.byType(LoginPage), findsNothing);
      expect(_fullLocation(router), '/search?category=escolar');
      expect(_bar(tester).selectedIndex, 1);
      expect(
        tester.widget<SearchPage>(find.byType(SearchPage)).initialQuery,
        const ProductQuery(categorySlug: 'escolar'),
      );
    });

    testWidgets('na Conta sem sessão, "Entrar" abre a tela cheia e entrar '
        'volta à Conta com "Olá, Ana"', (tester) async {
      final router = await _openLoginFromAccount(tester);

      expect(find.byType(LoginPage), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);

      await _signIn(tester);

      expect(_session.signInCalls, hasLength(1));
      expect(find.byType(LoginPage), findsNothing);
      expect(find.byType(AccountPage), findsOneWidget);
      expect(find.text(AccountPage.greeting('Ana')), findsOneWidget);
      expect(find.text(LoginPage.welcomeMessage('Ana')), findsOneWidget);
      expect(_bar(tester).selectedIndex, 3);
      expect(_location(router), AppRoutes.account);
    });

    testWidgets('"Criar conta" a partir de "Entrar" mantém o destino', (
      tester,
    ) async {
      final router = await _openLoginFromAccount(tester);

      await tester.tap(find.text(LoginPage.registerLink));
      await tester.pumpAndSettle();

      expect(find.byType(LoginPage), findsNothing);
      expect(find.byType(RegisterPage), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);

      await _enterText(tester, RegisterPage.nameLabel, 'Ana Souza');
      await _enterText(tester, RegisterPage.emailLabel, 'ana@exemplo.com');
      await _enterText(tester, RegisterPage.passwordLabel, '#Senha123');
      await _enterText(tester, RegisterPage.confirmPasswordLabel, '#Senha123');
      await tester.ensureVisible(
        find.widgetWithText(AppButton, RegisterPage.submitLabel),
      );
      await tester.tap(
        find.widgetWithText(AppButton, RegisterPage.submitLabel),
      );
      await tester.pumpAndSettle();

      expect(_session.signUpCalls, hasLength(1));
      expect(find.byType(RegisterPage), findsNothing);
      expect(find.text(AccountPage.greeting('Ana')), findsOneWidget);
      expect(_bar(tester).selectedIndex, 3);
      expect(_location(router), AppRoutes.account);
    });

    testWidgets('fechar "Entrar" volta à Conta', (tester) async {
      final router = await _openLoginFromAccount(tester);

      await tester.tap(find.byType(CloseButton));
      await tester.pumpAndSettle();

      expect(find.byType(LoginPage), findsNothing);
      expect(find.text(AccountPage.inviteTitle), findsOneWidget);
      expect(_bar(tester).selectedIndex, 3);
      expect(_location(router), AppRoutes.account);
    });

    testWidgets('/account/delivery sem sessão leva a "Entrar" com o destino '
        'e, depois de entrar, abre os dados de entrega na aba Conta', (
      tester,
    ) async {
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.deliveryDetails,
      );

      expect(find.byType(LoginPage), findsOneWidget);
      expect(find.byType(DeliveryDetailsPage), findsNothing);
      expect(_fullLocation(router), '/login?from=%2Faccount%2Fdelivery');

      await _signIn(tester);

      expect(find.byType(LoginPage), findsNothing);
      expect(find.byType(DeliveryDetailsPage), findsOneWidget);
      expect(_bar(tester).selectedIndex, 3);
      expect(_location(router), AppRoutes.deliveryDetails);
    });

    testWidgets('com sessão, "Dados de entrega" na Conta abre a tela na pilha '
        'da aba, e voltar retorna à Conta', (tester) async {
      await _useSession(FakeAuthRepository(currentUser: ana));
      final router = await _pumpRouter(
        tester,
        initialLocation: AppRoutes.account,
      );

      await tester.tap(
        find.widgetWithText(AppButton, AccountPage.deliveryDetailsLabel),
      );
      await tester.pumpAndSettle();

      expect(find.byType(DeliveryDetailsPage), findsOneWidget);
      expect(find.text(DeliveryDetailsPage.title), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(_bar(tester).selectedIndex, 3);
      expect(_location(router), AppRoutes.deliveryDetails);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.byType(DeliveryDetailsPage), findsNothing);
      expect(find.text(AccountPage.greeting('Ana')), findsOneWidget);
      expect(_location(router), AppRoutes.account);
    });

    testWidgets('/login?from=https://exemplo.com leva à Início depois de '
        'entrar', (tester) async {
      final router = await _pumpRouter(
        tester,
        initialLocation: '/login?from=https://exemplo.com',
      );

      expect(find.byType(LoginPage), findsOneWidget);

      await _signIn(tester);

      expect(find.byType(LoginPage), findsNothing);
      expect(find.byType(HomePage), findsOneWidget);
      expect(_location(router), AppRoutes.home);
    });
  });

  group('AppRoutes', () {
    test('searchLocation sem filtros é /search, sem "?"', () {
      expect(AppRoutes.searchLocation(const ProductQuery()), '/search');
    });

    test('searchLocation codifica os filtros com os nomes da API', () {
      expect(
        AppRoutes.searchLocation(
          const ProductQuery(onSale: true, sort: ProductSort.discount),
        ),
        '/search?onSale=true&sort=discount',
      );
      expect(
        AppRoutes.searchLocation(const ProductQuery(categorySlug: 'escolar')),
        '/search?category=escolar',
      );
    });

    test('productLocation monta o caminho do produto pelo slug', () {
      expect(AppRoutes.productLocation('caneta-x'), '/home/product/caneta-x');
      expect(AppRoutes.product, '/home/product/:slug');
    });

    test('searchProductLocation monta o produto na pilha da Buscar e codifica '
        'o slug', () {
      expect(
        AppRoutes.searchProductLocation('caneta x'),
        '/search/product/caneta%20x',
      );
      expect(AppRoutes.searchProduct, '/search/product/:slug');
    });

    test('cartProductLocation monta o produto na pilha do Carrinho e codifica '
        'o slug', () {
      expect(
        AppRoutes.cartProductLocation('caneta x'),
        '/cart/product/caneta%20x',
      );
      expect(AppRoutes.cartProduct, '/cart/product/:slug');
    });
  });

  group('rota desconhecida', () {
    testWidgets('mostra "Página não encontrada" e volta ao Início', (
      tester,
    ) async {
      final router = await _pumpRouter(tester, initialLocation: '/nao-existe');

      expect(find.text('Página não encontrada'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);

      await tester.tap(find.text('Voltar ao início'));
      await tester.pumpAndSettle();

      expect(find.byType(HomePage), findsOneWidget);
      expect(_location(router), AppRoutes.home);
    });
  });
}
