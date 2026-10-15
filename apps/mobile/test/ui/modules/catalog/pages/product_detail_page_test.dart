import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
import 'package:mobile/modules/cart/errors/cart_errors.dart';
import 'package:mobile/modules/cart/model/cart_entity.dart';
import 'package:mobile/modules/cart/model/cart_state.dart';
import 'package:mobile/modules/catalog/model/product_detail_entity.dart';
import 'package:mobile/modules/catalog/model/product_query.dart';
import 'package:mobile/modules/catalog/model/product_query_params.dart';
import 'package:mobile/ui/modules/catalog/pages/product_detail_page.dart';
import 'package:mobile/ui/modules/catalog/view_models/product_detail_view_model.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_description.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_gallery.dart';
import 'package:mobile/ui/modules/catalog/widgets/product_rail.dart';
import 'package:mobile/ui/shared/theme/app_theme.dart';
import 'package:mobile/ui/shared/widgets/app_button.dart';
import 'package:mobile/ui/shared/widgets/empty_state.dart';
import 'package:mobile/ui/shared/widgets/product_card.dart';
import 'package:mobile/ui/shared/widgets/quantity_stepper.dart';
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';
import 'package:mobile/ui/shared/widgets/state_error_banner.dart';

import '../../../../modules/cart/support/fake_cart_repository.dart';
import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../../modules/catalog/support/fake_catalog_repository.dart';
import '../../../shared/support/fake_image_loads.dart';
import '../../../shared/support/money.dart';

const _notFoundFailure = NotFoundFailure(
  message: 'Não encontramos o que você procurou.',
  code: HttpFailureCode.notFound,
);

const _serverFailure = ServerFailure(
  message:
      'O servidor está indisponível no momento. Tente novamente em '
      'instantes.',
  code: HttpFailureCode.server,
);

// A página rola; o viewport cresce para os blocos serem montados e visíveis
// sem rolar (a `ListView` só monta o que está à vista).
const _surface = Size(800, 2400);

/// Produto de R$ 12,90 para as contas do rodapé (3 × R$ 12,90 = R$ 38,70).
final _pen = plainDetail.copyWith(price: money(1290));

/// Os outros produtos de "Toners HP" que o fake devolve por padrão (sem foto).
final _related = manyProducts(5, prefix: 'toner');

/// Monta a página como a rota faz: a fábrica cria o ViewModel de verdade
/// sobre o repositório fake, que devolve [product], e o carrinho [cart]
/// (padrão: vazio). As seis fotos de `tonerDetail` ficam presas no
/// placeholder (sem rede nem cache do aparelho).
Future<FakeCatalogRepository> _pumpPage(
  WidgetTester tester, {
  ProductDetail? product,
  FakeCartRepository? cart,
  void Function(FakeCatalogRepository repository)? prepare,
  VoidCallback? onBack,
  ValueChanged<ProductQuery>? onOpenSearch,
  ValueChanged<String>? onOpenProduct,
  VoidCallback? onOpenCart,
}) async {
  tester.view.physicalSize = _surface;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  for (final image in tonerDetail.images) {
    holdImageLoad(image.largeUrl);
    holdImageLoad(image.thumbUrl);
  }

  final detail = product ?? tonerDetail;
  final catalog = FakeCatalogRepository(product: detail, products: _related);
  prepare?.call(catalog);
  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light(),
      home: ProductDetailPage(
        slug: detail.slug,
        productDetailViewModelFactory: () =>
            ProductDetailViewModel(catalog, cart ?? FakeCartRepository()),
        onBack: onBack ?? () {},
        onOpenSearch: onOpenSearch ?? (_) {},
        onOpenProduct: onOpenProduct ?? (_) {},
        onOpenCart: onOpenCart ?? () {},
      ),
    ),
  );
  return catalog;
}

/// O botão `Adicionar · <total>`, qualquer que seja o total.
Finder get _addToCart => find.byWidgetPredicate(
  (widget) => widget is AppButton && widget.label.startsWith('Adicionar ·'),
);

Finder _addButton(String label) => find.widgetWithText(AppButton, label);

Finder get _increment =>
    find.bySemanticsLabel(QuantityStepper.incrementLabel(_pen.name));

Finder get _decrement =>
    find.bySemanticsLabel(QuantityStepper.decrementLabel(_pen.name));

Future<void> _tapTimes(WidgetTester tester, Finder finder, int times) async {
  for (var index = 0; index < times; index++) {
    await tester.tap(finder);
    await tester.pump();
  }
}

Finder get _relatedTitle =>
    find.text(ProductDetailPage.relatedTitle('Toners HP'));

void main() {
  group('conteúdo', () {
    testWidgets('tonerDetail mostra os selos, a marca, o nome, a unidade com '
        'o código, o preço com o "De:", a descrição e a ficha', (tester) async {
      final catalog = await _pumpPage(tester);
      await tester.pumpAndSettle();

      expect(catalog.productSlugs, [tonerDetail.slug]);
      expect(find.byType(ProductGallery), findsOneWidget);
      expect(find.text('Em destaque'), findsOneWidget);
      expect(find.text('−30%'), findsOneWidget);
      expect(find.text('HP'), findsOneWidget);
      expect(find.text(tonerDetail.name), findsOneWidget);
      expect(find.text('caixa com 1 · Cód. 796915'), findsOneWidget);
      expect(find.textContaining('· Cód.'), findsOneWidget);
      expect(find.text('R\$ 34,90'), findsOneWidget);
      expect(find.text('R\$ 49,90'), findsOneWidget);
      expect(find.text(ProductDescription.title), findsOneWidget);
      expect(find.text('Marca · HP', findRichText: true), findsOneWidget);
      expect(
        find.text(
          'Categoria · Cartuchos & Toners / Toners HP',
          findRichText: true,
        ),
        findsOneWidget,
      );
      expect(find.text('Código · 796915', findRichText: true), findsOneWidget);
      expect(
        find.text('Unidade · caixa com 1', findRichText: true),
        findsOneWidget,
      );
    });

    testWidgets('o rodapé mostra a quantidade 1 e "Adicionar · R\$ 12,90" '
        'habilitado, sem "Você já tem"', (tester) async {
      await _pumpPage(tester, product: _pen);
      await tester.pumpAndSettle();

      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
      expect(scaffold.bottomNavigationBar, isNotNull);
      final inFooter = find.descendant(
        of: find.byWidget(scaffold.bottomNavigationBar!),
        matching: _addButton('Adicionar · R\$ 12,90'),
      );
      expect(inFooter, findsOneWidget);
      expect(tester.widget<AppButton>(inFooter).onPressed, isNotNull);
      expect(
        tester.widget<QuantityStepper>(find.byType(QuantityStepper)).quantity,
        1,
      );
      expect(find.textContaining('Você já tem'), findsNothing);
    });

    testWidgets('o cartão de entrega mostra a regra de frete do carrinho', (
      tester,
    ) async {
      await _pumpPage(tester);
      await tester.pumpAndSettle();

      expect(find.text('Entrega grátis acima de R\$ 79,00'), findsOneWidget);
      expect(find.text('Abaixo disso, taxa fixa de R\$ 4,90'), findsOneWidget);
    });

    testWidgets('plainDetail não mostra selos, marca, código, descrição nem '
        'as linhas "Marca" e "Código"', (tester) async {
      await _pumpPage(tester, product: plainDetail);
      await tester.pumpAndSettle();

      expect(find.text(plainDetail.name), findsOneWidget);
      expect(find.text('unidade'), findsOneWidget);
      expect(find.textContaining('· Cód.'), findsNothing);
      expect(find.text('Em destaque'), findsNothing);
      expect(find.textContaining('%'), findsNothing);
      expect(find.text(ProductDescription.title), findsNothing);
      expect(find.textContaining('Marca', findRichText: true), findsNothing);
      expect(find.textContaining('Código', findRichText: true), findsNothing);
      expect(
        find.text('Unidade · unidade', findRichText: true),
        findsOneWidget,
      );
      expect(find.text('R\$ 7,50'), findsOneWidget);
      expect(_addToCart, findsOneWidget);
    });
  });

  group('adicionar ao carrinho', () {
    testWidgets('com quantidade 3, o botão mostra "Adicionar · R\$ 38,70" e o '
        '"−" volta a quantidade', (tester) async {
      await _pumpPage(tester, product: _pen);
      await tester.pumpAndSettle();

      await _tapTimes(tester, _increment, 2);

      expect(_addButton('Adicionar · R\$ 38,70'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);

      await _tapTimes(tester, _decrement, 1);

      expect(_addButton('Adicionar · R\$ 25,80'), findsOneWidget);
    });

    testWidgets('enquanto inclui, mostra "Adicionando…" desabilitado; no '
        'sucesso avisa "Adicionado ao carrinho" com "3 un · R\$ 38,70", volta '
        'a 1 e mostra "Você já tem 3 no carrinho."', (tester) async {
      final cart = FakeCartRepository();
      final pending = cart.holdAdd();
      await _pumpPage(tester, product: _pen, cart: cart);
      await tester.pumpAndSettle();
      await _tapTimes(tester, _increment, 2);

      await tester.tap(_addButton('Adicionar · R\$ 38,70'));
      await tester.pump();

      final adding = _addButton(ProductDetailPage.addingLabel);
      expect(adding, findsOneWidget);
      expect(tester.widget<AppButton>(adding).onPressed, isNull);
      expect(cart.addCalls, [(productId: _pen.id, quantity: 3)]);

      pending.complete(const Ok(null));
      await tester.pumpAndSettle();

      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.text(ProductDetailPage.addedTitle), findsOneWidget);
      expect(find.text('3 un · R\$ 38,70'), findsOneWidget);
      expect(find.text(ProductDetailPage.openCartAction), findsOneWidget);
      expect(_addButton('Adicionar · R\$ 12,90'), findsOneWidget);
      expect(find.text('Você já tem 3 no carrinho.'), findsOneWidget);
    });

    testWidgets('"Ver carrinho" no aviso chama onOpenCart', (tester) async {
      var opened = 0;
      await _pumpPage(tester, product: _pen, onOpenCart: () => opened++);
      await tester.pumpAndSettle();

      await tester.tap(_addButton('Adicionar · R\$ 12,90'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(ProductDetailPage.openCartAction));
      await tester.pump();

      expect(opened, 1);
    });

    testWidgets('com o produto no carrinho, mostra "Você já tem 3 no '
        'carrinho."', (tester) async {
      final cart = FakeCartRepository(
        state: CartState(items: [CartItem(productId: _pen.id, quantity: 3)]),
      );
      await _pumpPage(tester, product: _pen, cart: cart);
      await tester.pumpAndSettle();

      expect(find.text('Você já tem 3 no carrinho.'), findsOneWidget);
    });

    testWidgets('com 98 no carrinho, adicionar 3 mostra "Limite de 99 '
        'unidades por produto." e o carrinho continua com 98', (tester) async {
      final cart = FakeCartRepository(
        state: CartState(items: [CartItem(productId: _pen.id, quantity: 98)]),
      );
      await _pumpPage(tester, product: _pen, cart: cart);
      await tester.pumpAndSettle();
      await _tapTimes(tester, _increment, 2);

      await tester.tap(_addButton('Adicionar · R\$ 38,70'));
      await tester.pumpAndSettle();

      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.text(CartErrorCode.quantityExceeded.message), findsOneWidget);
      expect(find.text('Limite de 99 unidades por produto.'), findsOneWidget);
      expect(find.text(ProductDetailPage.addedTitle), findsNothing);
      expect(cart.state.quantityOf(_pen.id), 98);
      expect(find.text('Você já tem 98 no carrinho.'), findsOneWidget);
      expect(_addButton('Adicionar · R\$ 38,70'), findsOneWidget);
    });
  });

  group('estados', () {
    testWidgets('mostra o skeleton enquanto o produto carrega, sem o botão do '
        'rodapé', (tester) async {
      late Completer<Result<ProductDetail>> pending;
      await _pumpPage(
        tester,
        prepare: (repository) => pending = repository.holdProduct(),
      );
      await tester.pump();

      expect(find.byType(SkeletonBox), findsWidgets);
      expect(find.bySemanticsLabel('Carregando'), findsOneWidget);
      expect(find.text(tonerDetail.name), findsNothing);
      expect(find.byType(BackButton), findsOneWidget);
      expect(_addToCart, findsNothing);
      expect(
        tester.widget<Scaffold>(find.byType(Scaffold)).bottomNavigationBar,
        isNull,
      );

      pending.complete(Ok(tonerDetail));
      await tester.pumpAndSettle();

      expect(find.byType(SkeletonBox), findsNothing);
      expect(find.text(tonerDetail.name), findsOneWidget);
      expect(_addToCart, findsOneWidget);
    });

    testWidgets('500 mostra "Não foi possível carregar o produto." e "Tentar '
        'de novo" pede o produto de novo', (tester) async {
      final catalog = await _pumpPage(
        tester,
        prepare: (repository) =>
            repository.enqueueProduct(const Failure(_serverFailure)),
      );
      await tester.pumpAndSettle();

      expect(find.byType(StateErrorBanner), findsOneWidget);
      expect(find.text(ProductDetailPage.errorTitle), findsOneWidget);
      expect(find.text(_serverFailure.message), findsOneWidget);
      expect(find.text(ProductDetailPage.notFoundTitle), findsNothing);
      expect(find.byType(BackButton), findsOneWidget);
      expect(_addToCart, findsNothing);
      expect(catalog.productSlugs, hasLength(1));

      await tester.tap(find.text('Tentar de novo'));
      await tester.pumpAndSettle();

      expect(catalog.productSlugs, [tonerDetail.slug, tonerDetail.slug]);
      expect(find.byType(StateErrorBanner), findsNothing);
      expect(find.text(tonerDetail.name), findsOneWidget);
      expect(_addToCart, findsOneWidget);
    });

    testWidgets('404 mostra "Produto não encontrado" e "Voltar ao catálogo" '
        'abre a Buscar sem filtros', (tester) async {
      final queries = <ProductQuery>[];
      await _pumpPage(
        tester,
        prepare: (repository) =>
            repository.enqueueProduct(const Failure(_notFoundFailure)),
        onOpenSearch: queries.add,
      );
      await tester.pumpAndSettle();

      expect(find.byType(EmptyState), findsOneWidget);
      expect(find.text(ProductDetailPage.notFoundTitle), findsOneWidget);
      expect(find.text(ProductDetailPage.notFoundMessage), findsOneWidget);
      expect(find.byType(StateErrorBanner), findsNothing);
      expect(find.byType(BackButton), findsOneWidget);
      expect(_addToCart, findsNothing);

      await tester.tap(find.text(ProductDetailPage.notFoundAction));
      await tester.pump();

      expect(queries, [const ProductQuery()]);
    });
  });

  group('navegação e relacionados', () {
    testWidgets('tocar na marca abre a Buscar filtrada pela marca', (
      tester,
    ) async {
      final queries = <ProductQuery>[];
      await _pumpPage(tester, onOpenSearch: queries.add);
      await tester.pumpAndSettle();

      await tester.tap(find.text('HP'));
      await tester.pump();

      expect(queries, [
        const ProductQuery(brandSlugs: ['hp']),
      ]);
    });

    testWidgets('tocar numa categoria da trilha abre a Buscar filtrada por '
        'ela', (tester) async {
      final queries = <ProductQuery>[];
      await _pumpPage(tester, onOpenSearch: queries.add);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Cartuchos & Toners'));
      await tester.pump();
      await tester.tap(find.text('Toners HP'));
      await tester.pump();

      expect(queries, [
        const ProductQuery(categorySlug: 'cartuchos-toners'),
        const ProductQuery(categorySlug: 'toners-hp'),
      ]);
    });

    testWidgets('"Mais de Toners HP" mostra 4 cards da categoria e o toque '
        'abre o produto', (tester) async {
      final opened = <String>[];
      final catalog = await _pumpPage(tester, onOpenProduct: opened.add);
      await tester.pumpAndSettle();

      expect(encodeProductQuery(catalog.productQueries.single), {
        'category': 'toners-hp',
        'sort': 'featured',
        'pageSize': '5',
      });
      expect(_relatedTitle, findsOneWidget);
      final cards = find.descendant(
        of: find.byType(ProductRail),
        matching: find.byType(ProductCard),
      );
      expect(cards, findsNWidgets(4));

      await tester.ensureVisible(cards.first);
      await tester.pumpAndSettle();
      await tester.tap(cards.first);
      await tester.pump();

      expect(opened, [_related.first.slug]);
    });

    testWidgets('sem outros produtos da categoria, a seção não aparece', (
      tester,
    ) async {
      final catalog = await _pumpPage(
        tester,
        prepare: (repository) => repository.enqueueProducts(
          Ok(pageOf([finePen.copyWith(id: tonerDetail.id)])),
        ),
      );
      await tester.pumpAndSettle();

      expect(catalog.productQueries, hasLength(1));
      expect(_relatedTitle, findsNothing);
      expect(find.byType(ProductRail), findsNothing);
      expect(find.text(tonerDetail.name), findsOneWidget);
    });

    testWidgets('voltar chama onBack', (tester) async {
      var backs = 0;
      await _pumpPage(tester, onBack: () => backs++);
      await tester.pumpAndSettle();

      await tester.tap(find.byType(BackButton));
      await tester.pump();

      expect(backs, 1);
    });
  });
}
