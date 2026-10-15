import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/errors/app_failure.dart';
import 'package:mobile/core/result.dart';
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
import 'package:mobile/ui/shared/widgets/skeleton_box.dart';
import 'package:mobile/ui/shared/widgets/state_error_banner.dart';

import '../../../../modules/catalog/support/catalog_fixtures.dart';
import '../../../../modules/catalog/support/fake_catalog_repository.dart';
import '../../../shared/support/fake_image_loads.dart';

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

/// Os outros produtos de "Toners HP" que o fake devolve por padrão (sem foto).
final _related = manyProducts(5, prefix: 'toner');

/// Monta a página como a rota faz: a fábrica cria o ViewModel de verdade
/// sobre o repositório fake, que devolve [product]. As seis fotos de
/// `tonerDetail` ficam presas no placeholder (sem rede nem cache do aparelho).
Future<FakeCatalogRepository> _pumpPage(
  WidgetTester tester, {
  ProductDetail? product,
  void Function(FakeCatalogRepository repository)? prepare,
  VoidCallback? onBack,
  ValueChanged<ProductQuery>? onOpenSearch,
  ValueChanged<String>? onOpenProduct,
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
        productDetailViewModelFactory: () => ProductDetailViewModel(catalog),
        onBack: onBack ?? () {},
        onOpenSearch: onOpenSearch ?? (_) {},
        onOpenProduct: onOpenProduct ?? (_) {},
      ),
    ),
  );
  return catalog;
}

Finder get _addToCart =>
    find.widgetWithText(AppButton, ProductDetailPage.addToCartLabel);

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

    testWidgets('"Adicionar ao carrinho" fica no rodapé, desabilitado', (
      tester,
    ) async {
      await _pumpPage(tester);
      await tester.pumpAndSettle();

      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
      expect(scaffold.bottomNavigationBar, isNotNull);
      final inFooter = find.descendant(
        of: find.byWidget(scaffold.bottomNavigationBar!),
        matching: _addToCart,
      );
      expect(inFooter, findsOneWidget);
      expect(tester.widget<AppButton>(inFooter).onPressed, isNull);
      expect(_addToCart, findsOneWidget);
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
